import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { normalizeIanaTimezone } from "@/shared/domain/date/utils/timezone";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import type { RegisterPushTokenData } from "../../ports/notification-data";
import { PUSH_PROVIDER, type PushProvider } from "../../ports/push-provider.port";
import {
	PUSH_TOKEN_REPOSITORY,
	type PushTokenRepositoryPort,
} from "../../ports/push-token.repository.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../../ports/user-notification-settings.port";

/**
 * 푸시 토큰 등록 유스케이스.
 *
 * 토큰 형식 검증(NOTIFICATION_1001) → upsert → 푸시 토큰 캐시 무효화 →
 * 타임존·로케일 반영(있을 때만) → preference 캐시 무효화.
 */
@Injectable()
export class RegisterPushTokenUseCase {
	readonly #logger = new Logger(RegisterPushTokenUseCase.name);

	constructor(
		@Inject(PUSH_TOKEN_REPOSITORY)
		private readonly pushTokenRepository: PushTokenRepositoryPort,
		@Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
		@Inject(USER_NOTIFICATION_SETTINGS)
		private readonly userSettings: UserNotificationSettingsPort,
		@Inject(NOTIFICATION_CACHE)
		private readonly cache: NotificationCachePort,
	) {}

	async execute(data: RegisterPushTokenData): Promise<void> {
		if (!this.pushProvider.validateToken(data.token)) {
			throw new ApplicationException(ErrorCode.NOTIFICATION_1001, {
				token: data.token,
			});
		}

		const timezone = normalizeIanaTimezone(data.timezone) ?? undefined;
		await this.pushTokenRepository.registerPushToken({ ...data, timezone });
		await this.cache.invalidatePushTokens(data.userId);

		if (timezone) {
			await this.userSettings.upsertPushTimezone(data.userId, timezone);
		}

		if (data.locale) {
			await this.userSettings.upsertPushLocale(data.userId, data.locale);
		}

		if (timezone || data.locale) {
			await this.cache.invalidateUserPreference(data.userId);
		}

		this.#logger.log(`Push token registered: userId=${data.userId}, deviceId=${data.deviceId}`);
	}
}
