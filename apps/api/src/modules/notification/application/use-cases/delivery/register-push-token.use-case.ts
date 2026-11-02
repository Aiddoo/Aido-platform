import { ErrorCode } from "@aido/api/errors";
import { uniq } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { normalizeIanaTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import type { RegisterPushTokenData } from "../../ports/delivery/notification-data.js";
import { type PushProvider } from "../../ports/delivery/push-provider.port.js";
import {
  PushTokenRegistrationConflictError,
  type PushTokenRepositoryPort,
} from "../../ports/delivery/push-token.repository.port.js";
import { type UserNotificationSettingsPort } from "../../ports/delivery/user-notification-settings.port.js";

/**
 * 푸시 토큰 등록 유스케이스.
 *
 * 토큰 형식 검증(NOTIFICATION_1001) → (한 트랜잭션) 다른 등록이 가진 같은 토큰 해제 + upsert →
 * (같은 토큰 동시 등록으로 충돌하면 새 트랜잭션에서 한 번만 재시도) →
 * 푸시 토큰 캐시 무효화(이전 소유자 포함) → 타임존·로케일 반영(있을 때만) → preference 캐시 무효화.
 */
interface RegisterPushTokenDependencies {
  readonly pushTokenRepository: Pick<
    PushTokenRepositoryPort,
    "releasePushTokenHeldElsewhere" | "registerPushToken"
  >;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly pushProvider: Pick<PushProvider, "validateToken">;
  readonly userSettings: Pick<
    UserNotificationSettingsPort,
    "upsertPushLocale" | "upsertPushTimezone"
  >;
  readonly cache: Pick<NotificationCachePort, "invalidatePushTokens" | "invalidateUserPreference">;
  readonly logger: Pick<ApplicationLogger, "log" | "warn">;
}

export class RegisterPushToken {
  readonly #dependencies: RegisterPushTokenDependencies;

  constructor(dependencies: RegisterPushTokenDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(data: RegisterPushTokenData): Promise<void> {
    if (!this.#dependencies.pushProvider.validateToken(data.token)) {
      throw new ApplicationException(ErrorCode.NOTIFICATION_1001, {
        token: data.token,
      });
    }

    const timezone = normalizeIanaTimezone(data.timezone) ?? undefined;
    const { userIds: releasedUserIds } = await this.#registerWithSingleRetry(data, timezone);
    const previousUserIds = uniq(releasedUserIds.filter((userId) => userId !== data.userId));
    await Promise.all(
      uniq([data.userId, ...releasedUserIds]).map((userId) =>
        this.#dependencies.cache.invalidatePushTokens(userId),
      ),
    );
    if (previousUserIds.length > 0) {
      this.#dependencies.logger.log({
        event: NotificationDeliveryLogEvent.REGISTER_PUSH_TOKEN_OWNER_TRANSFERRED,
        userId: data.userId,
        previousUserIds,
      });
    }

    if (timezone) {
      await this.#dependencies.userSettings.upsertPushTimezone(data.userId, timezone);
    }

    if (data.locale) {
      await this.#dependencies.userSettings.upsertPushLocale(data.userId, data.locale);
    }

    if (timezone || data.locale) {
      await this.#dependencies.cache.invalidateUserPreference(data.userId);
    }

    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.REGISTER_PUSH_TOKEN_REGISTERED,
      userId: data.userId,
    });
  }

  async #registerWithSingleRetry(
    data: RegisterPushTokenData,
    timezone: string | undefined,
  ): Promise<{ readonly userIds: readonly string[] }> {
    try {
      return await this.#releaseAndRegister(data, timezone);
    } catch (error) {
      if (!(error instanceof PushTokenRegistrationConflictError)) {
        throw error;
      }
      this.#dependencies.logger.warn({
        event: NotificationDeliveryLogEvent.REGISTER_PUSH_TOKEN_CONFLICT_RETRIED,
        userId: data.userId,
      });
      return this.#releaseAndRegister(data, timezone);
    }
  }

  #releaseAndRegister(
    data: RegisterPushTokenData,
    timezone: string | undefined,
  ): Promise<{ readonly userIds: readonly string[] }> {
    return this.#dependencies.unitOfWork.run(async () => {
      const released =
        await this.#dependencies.pushTokenRepository.releasePushTokenHeldElsewhere(data);
      await this.#dependencies.pushTokenRepository.registerPushToken({ ...data, timezone });
      return released;
    });
  }
}
