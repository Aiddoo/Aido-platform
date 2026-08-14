import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";

/**
 * 모든 알림 읽음 처리 유스케이스.
 */
@Injectable()
export class MarkAllAsReadUseCase {
	readonly #logger = new Logger(MarkAllAsReadUseCase.name);

	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(NOTIFICATION_CACHE)
		private readonly cache: NotificationCachePort,
	) {}

	async execute(userId: string): Promise<{ count: number }> {
		const result = await this.notificationRepository.markAllAsRead(userId);
		await this.cache.invalidateUnreadCount(userId);

		this.#logger.debug(`All notifications read processed: userId=${userId}, count=${result.count}`);

		return result;
	}
}
