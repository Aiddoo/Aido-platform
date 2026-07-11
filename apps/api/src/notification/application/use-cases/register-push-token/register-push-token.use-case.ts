import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import type { RegisterPushTokenData } from "../../ports/notification-data";
import {
	PUSH_PROVIDER,
	type PushProvider,
} from "../../ports/push-provider.port";
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
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
		@Inject(USER_NOTIFICATION_SETTINGS)
		private readonly userSettings: UserNotificationSettingsPort,
		private readonly cacheService: CacheService,
	) {}

	async execute(data: RegisterPushTokenData): Promise<void> {
		if (!this.pushProvider.validateToken(data.token)) {
			throw new ApplicationException(ErrorCode.NOTIFICATION_1001, {
				token: data.token,
			});
		}

		await this.notificationRepository.registerPushToken(data);
		await this.cacheService.invalidatePushTokens(data.userId);

		if (data.timezone) {
			await this.userSettings.upsertPushTimezone(data.userId, data.timezone);
		}

		if (data.locale) {
			await this.userSettings.upsertPushLocale(data.userId, data.locale);
		}

		if (data.timezone || data.locale) {
			await this.cacheService.invalidateUserPreference(data.userId);
		}

		this.#logger.log(
			`Push token registered: userId=${data.userId}, deviceId=${data.deviceId}`,
		);
	}
}
