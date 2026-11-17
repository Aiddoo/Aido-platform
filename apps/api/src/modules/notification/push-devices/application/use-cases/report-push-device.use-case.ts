import type { PushDevicePlatform, PushPermissionStatus } from "@aido/api/vocabulary";
import { uniq } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { normalizeIanaTimezone } from "#api/shared/domain/time/time-zone-name";

import type { UserNotificationSettingsPort } from "../../../shared/application/ports/user-notification-settings.port.js";
import { PushDeviceId } from "../../domain/push-device-id.vo.js";
import { PushDevice } from "../../domain/push-device.aggregate.js";
import { platformFromDeviceId } from "../../domain/push-device.domain-service.js";
import { PushPermission } from "../../domain/push-permission.vo.js";
import { PushToken } from "../../domain/push-token.entity.js";
import type {
  PushDeviceRepositoryPort,
  SavedPushDeviceResult,
} from "../ports/push-device.repository.port.js";
import type { PushTokenCachePort } from "../ports/push-token-cache.port.js";
import type { PushTokenFormatPort } from "../ports/push-token-format.port.js";
import { invalidPushToken, PushTokenRegistrationConflictError } from "../push-devices.errors.js";
import { PushDeviceLogEvent } from "../push-devices.log-events.js";

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
  readonly pushDeviceRepository: Pick<PushDeviceRepositoryPort, "save">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly pushTokenFormat: Pick<PushTokenFormatPort, "isValid">;
  readonly userSettings: Pick<
    UserNotificationSettingsPort,
    "upsertPushLocale" | "upsertPushTimezone"
  >;
  readonly cache: Pick<PushTokenCachePort, "invalidatePushTokens" | "invalidateUserPreference">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/**
 * 기기 하나의 알림 권한과 토큰을 저장한다.
 *
 * 권한이 발송을 허용하고 토큰이 있으면 토큰을 등록하고, 토큰이 없으면 기존 토큰을 두며, 권한이 없으면 이 기기의 토큰을 지운다.
 * 다른 사용자의 같은 기기·같은 토큰 등록은 넘겨받는다(PushDevice.takeover).
 * 같은 토큰을 동시에 등록해 충돌하면 새 트랜잭션에서 한 번만 다시 시도한다.
 */
export class ReportPushDeviceUseCase {
  readonly #dependencies: ReportPushDeviceDependencies;

  constructor(dependencies: ReportPushDeviceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ReportPushDeviceCommand): Promise<PushDeviceReport> {
    if (command.token != null && !this.#dependencies.pushTokenFormat.isValid(command.token)) {
      throw invalidPushToken();
    }

    const device = PushDevice.create({
      id: PushDeviceId.reconstitute(command.deviceId),
      userId: UserId.reconstitute(command.userId),
      sessionId: command.sessionId,
      platform: platformFromDeviceId(command.deviceId) ?? command.platformHint ?? null,
      permission: PushPermission.create(command.permission),
      pushToken: PushToken.create({
        token: command.token,
        payloadVersion: command.payloadVersion,
        appVersion: command.appVersion,
      }),
      deviceModel: command.deviceModel,
      osVersion: command.osVersion,
      now: this.#dependencies.clock.now(),
    });

    const { previousOwnerIds, hasActiveToken } = await this.#saveWithSingleRetry(device, command);
    const previousUserIds = uniq(previousOwnerIds.filter((userId) => userId !== command.userId));
    await Promise.all(
      [command.userId, ...previousUserIds].map((userId) =>
        this.#dependencies.cache.invalidatePushTokens(UserId.reconstitute(userId)),
      ),
    );
    if (previousUserIds.length > 0) {
      this.#dependencies.logger.log({
        event: PushDeviceLogEvent.REPORT_PUSH_DEVICE_OWNER_TRANSFERRED,
        userId: command.userId,
        previousUserIds,
      });
    }

    await this.#syncDeliveryLocale(command);

    this.#dependencies.logger.log({
      event: PushDeviceLogEvent.REPORT_PUSH_DEVICE_REPORTED,
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
  ): Promise<SavedPushDeviceResult> {
    try {
      return await this.#save(device);
    } catch (error) {
      if (!(error instanceof PushTokenRegistrationConflictError)) {
        throw error;
      }
      this.#dependencies.logger.warn({
        event: PushDeviceLogEvent.REPORT_PUSH_DEVICE_TOKEN_CONFLICT_RETRIED,
        userId: command.userId,
      });
      return this.#save(device);
    }
  }

  #save(device: PushDevice): Promise<SavedPushDeviceResult> {
    return this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.pushDeviceRepository.save(device),
    );
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
