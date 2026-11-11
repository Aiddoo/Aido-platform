import { ErrorCode } from "@aido/api/errors";
import type { PushDevicePlatform, PushPermissionStatus } from "@aido/api/vocabulary";
import { uniq } from "es-toolkit";
import { match } from "ts-pattern";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { normalizeIanaTimezone } from "#api/shared/domain/time/time-zone-name";

import type { NotificationCachePort } from "../../../inbox/application/ports/notification-cache.port.js";
import { PushDeviceId } from "../../domain/push-device-id.vo.js";
import { PushDevice } from "../../domain/push-device.aggregate.js";
import { platformFromDeviceId } from "../../domain/push-device.domain-service.js";
import { PushPermission } from "../../domain/push-permission.vo.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type { PushDeviceRepositoryPort } from "../ports/push-device.repository.port.js";
import type { PushProviderPort } from "../ports/push-provider.port.js";
import {
  PushTokenRegistrationConflictError,
  type PushTokenRepositoryPort,
} from "../ports/push-token.repository.port.js";
import type { UserNotificationSettingsPort } from "../ports/user-notification-settings.port.js";

export interface ReportPushDeviceCommand {
  readonly userId: string;
  readonly sessionId: string | null;
  readonly deviceId: string;
  /** deviceId 접두어로 플랫폼을 알 수 없을 때만 쓰는 요청 헤더의 플랫폼. */
  readonly platformHint?: PushDevicePlatform;
  readonly permission: { readonly status: PushPermissionStatus; readonly canAskAgain: boolean };
  readonly token: string | null;
  readonly payloadVersion: number;
  readonly appVersion: string | null;
  readonly deviceModel: string | null;
  readonly osVersion: string | null;
  /** 보낸 경우에만 저장한다. 없으면 기존 발송 시간대·언어를 유지한다. */
  readonly timezone: string | null;
  readonly locale: string | null;
}

export interface PushDeviceReport {
  readonly deviceId: string;
  readonly platform: PushDevicePlatform;
  readonly permission: { readonly status: PushPermissionStatus; readonly canAskAgain: boolean };
  readonly hasActiveToken: boolean;
  readonly reportedAt: Temporal.Instant;
}

interface ReportPushDeviceDependencies {
  readonly pushDeviceRepository: Pick<
    PushDeviceRepositoryPort,
    "releasePushDeviceHeldElsewhere" | "savePushDevice"
  >;
  readonly pushTokenRepository: Pick<
    PushTokenRepositoryPort,
    | "releasePushTokenHeldElsewhere"
    | "registerPushToken"
    | "keepPushToken"
    | "deletePushTokensByDevice"
  >;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly pushProvider: Pick<PushProviderPort, "validateToken">;
  readonly userSettings: Pick<
    UserNotificationSettingsPort,
    "upsertPushLocale" | "upsertPushTimezone"
  >;
  readonly cache: Pick<NotificationCachePort, "invalidatePushTokens" | "invalidateUserPreference">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

interface SavedPushDevice {
  readonly releasedUserIds: readonly string[];
  readonly hasActiveToken: boolean;
}

/**
 * 기기 하나의 알림 권한과 토큰을 저장한다.
 *
 * 권한이 발송을 허용하고 토큰이 있으면 토큰을 등록하고, 토큰이 없으면 기존 토큰을 두며, 권한이 없으면 이 기기의 토큰을 지운다.
 * 같은 토큰을 동시에 등록해 충돌하면 새 트랜잭션에서 한 번만 다시 시도한다.
 */
export class ReportPushDeviceUseCase {
  readonly #dependencies: ReportPushDeviceDependencies;

  constructor(dependencies: ReportPushDeviceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ReportPushDeviceCommand): Promise<PushDeviceReport> {
    if (command.token != null && !this.#dependencies.pushProvider.validateToken(command.token)) {
      throw new ApplicationException(ErrorCode.NOTIFICATION_1001);
    }

    const device = PushDevice.create({
      id: PushDeviceId.reconstitute(command.deviceId),
      userId: UserId.reconstitute(command.userId),
      sessionId: command.sessionId,
      platform: platformFromDeviceId(command.deviceId) ?? command.platformHint ?? null,
      permission: PushPermission.create(command.permission),
      token: command.token,
      deviceModel: command.deviceModel,
      osVersion: command.osVersion,
      now: this.#dependencies.clock.now(),
    });

    const { releasedUserIds, hasActiveToken } = await this.#saveWithSingleRetry(device, command);
    const previousUserIds = uniq(releasedUserIds.filter((userId) => userId !== command.userId));
    await Promise.all(
      [command.userId, ...previousUserIds].map((userId) =>
        this.#dependencies.cache.invalidatePushTokens(UserId.reconstitute(userId)),
      ),
    );
    if (previousUserIds.length > 0) {
      this.#dependencies.logger.log({
        event: NotificationDeliveryLogEvent.REPORT_PUSH_DEVICE_OWNER_TRANSFERRED,
        userId: command.userId,
        previousUserIds,
      });
    }

    await this.#syncDeliveryLocale(command);

    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.REPORT_PUSH_DEVICE_REPORTED,
      userId: command.userId,
      platform: device.platform,
      permissionStatus: device.permission.status,
      hasActiveToken,
    });

    return {
      deviceId: device.id.value,
      platform: device.platform,
      permission: { status: device.permission.status, canAskAgain: device.permission.canAskAgain },
      hasActiveToken,
      reportedAt: device.reportedAt,
    };
  }

  async #saveWithSingleRetry(
    device: PushDevice,
    command: ReportPushDeviceCommand,
  ): Promise<SavedPushDevice> {
    try {
      return await this.#save(device, command);
    } catch (error) {
      if (!(error instanceof PushTokenRegistrationConflictError)) {
        throw error;
      }
      this.#dependencies.logger.warn({
        event: NotificationDeliveryLogEvent.REPORT_PUSH_DEVICE_TOKEN_CONFLICT_RETRIED,
        userId: command.userId,
      });
      return this.#save(device, command);
    }
  }

  #save(device: PushDevice, command: ReportPushDeviceCommand): Promise<SavedPushDevice> {
    const { pushDeviceRepository, pushTokenRepository } = this.#dependencies;
    const { userId, id: deviceId, tokenChange } = device;

    return this.#dependencies.unitOfWork.run(async () => {
      const devices = await pushDeviceRepository.releasePushDeviceHeldElsewhere(userId, deviceId);
      const tokens = await pushTokenRepository.releasePushTokenHeldElsewhere({
        userId,
        deviceId,
        token: tokenChange.kind === "REGISTER" ? tokenChange.token : null,
      });
      await pushDeviceRepository.savePushDevice(device);
      const hasActiveToken = await match(tokenChange)
        .with({ kind: "REGISTER" }, async ({ token }) => {
          await pushTokenRepository.registerPushToken({
            userId,
            token,
            deviceId,
            platform: device.platform,
            sessionId: device.sessionId,
            payloadVersion: command.payloadVersion,
            appVersion: command.appVersion,
            registeredAt: device.reportedAt,
          });
          return true;
        })
        .with({ kind: "KEEP" }, async () => {
          const kept = await pushTokenRepository.keepPushToken({
            userId,
            deviceId,
            sessionId: device.sessionId,
            payloadVersion: command.payloadVersion,
            appVersion: command.appVersion,
            keptAt: device.reportedAt,
          });
          return kept.hasActiveToken;
        })
        .with({ kind: "RELEASE" }, async () => {
          await pushTokenRepository.deletePushTokensByDevice(userId, deviceId);
          return false;
        })
        .exhaustive();
      return { releasedUserIds: [...devices.userIds, ...tokens.userIds], hasActiveToken };
    });
  }

  async #syncDeliveryLocale(command: ReportPushDeviceCommand): Promise<void> {
    const timezone = normalizeIanaTimezone(command.timezone);
    const userId = UserId.reconstitute(command.userId);
    if (timezone) {
      await this.#dependencies.userSettings.upsertPushTimezone(userId, timezone);
    }
    if (command.locale) {
      await this.#dependencies.userSettings.upsertPushLocale(userId, command.locale);
    }
    if (timezone || command.locale) {
      await this.#dependencies.cache.invalidateUserPreference(userId);
    }
  }
}
