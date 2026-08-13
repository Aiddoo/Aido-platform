import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
	PushTokenNotFoundError,
} from "../../ports/notification.repository.port";
import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";

/**
 * 푸시 토큰 해제 유스케이스.
 *
 * deviceId가 있으면 해당 기기 토큰만, 없으면 사용자의 모든 토큰을 해제한다.
 */
@Injectable()
export class UnregisterPushTokenUseCase {
	readonly #logger = new Logger(UnregisterPushTokenUseCase.name);

	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(NOTIFICATION_CACHE)
		private readonly cache: NotificationCachePort,
	) {}

	async execute(userId: string, deviceId?: string): Promise<void> {
		if (deviceId) {
			await this.#unregisterOne(userId, deviceId);
		} else {
			await this.#unregisterAll(userId);
		}
	}

	async #unregisterOne(userId: string, deviceId: string): Promise<void> {
		try {
			await this.notificationRepository.deletePushToken(userId, deviceId);
			await this.cache.invalidatePushTokens(userId);
			this.#logger.log(
				`Push token unregistered: userId=${userId}, deviceId=${deviceId}`,
			);
		} catch (error) {
			if (error instanceof PushTokenNotFoundError) {
				this.#logger.warn(
					`Push token not found: userId=${userId}, deviceId=${deviceId}`,
				);
				return;
			}
			throw error;
		}
	}

	async #unregisterAll(userId: string): Promise<void> {
		const result =
			await this.notificationRepository.deleteAllPushTokensByUser(userId);
		await this.cache.invalidatePushTokens(userId);
		this.#logger.log(
			`All push tokens unregistered: userId=${userId}, count=${result.count}`,
		);
	}
}
