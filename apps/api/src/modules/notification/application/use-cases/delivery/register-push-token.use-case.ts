import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { normalizeIanaTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import type { RegisterPushTokenData } from "../../ports/delivery/notification-data.js";
import { type PushProvider } from "../../ports/delivery/push-provider.port.js";
import { type PushTokenRepositoryPort } from "../../ports/delivery/push-token.repository.port.js";
import { type UserNotificationSettingsPort } from "../../ports/delivery/user-notification-settings.port.js";

/**
 * 푸시 토큰 등록 유스케이스.
 *
 * 토큰 형식 검증(NOTIFICATION_1001) → upsert → 푸시 토큰 캐시 무효화 →
 * 타임존·로케일 반영(있을 때만) → preference 캐시 무효화.
 */
interface RegisterPushTokenDependencies {
  readonly pushTokenRepository: PushTokenRepositoryPort;
  readonly pushProvider: PushProvider;
  readonly userSettings: UserNotificationSettingsPort;
  readonly cache: NotificationCachePort;
  readonly logger: ApplicationLogger;
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
    await this.#dependencies.pushTokenRepository.registerPushToken({ ...data, timezone });
    await this.#dependencies.cache.invalidatePushTokens(data.userId);

    if (timezone) {
      await this.#dependencies.userSettings.upsertPushTimezone(data.userId, timezone);
    }

    if (data.locale) {
      await this.#dependencies.userSettings.upsertPushLocale(data.userId, data.locale);
    }

    if (timezone || data.locale) {
      await this.#dependencies.cache.invalidateUserPreference(data.userId);
    }

    this.#dependencies.logger.log(
      `Push token registered: userId=${data.userId}, deviceId=${data.deviceId}`,
    );
  }
}
