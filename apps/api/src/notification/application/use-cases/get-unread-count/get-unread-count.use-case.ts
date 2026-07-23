import { Inject, Injectable } from "@nestjs/common";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";

/**
 * 읽지 않은 알림 수 조회 유스케이스 (2분 캐시).
 */
@Injectable()
export class GetUnreadCountUseCase {
	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(NOTIFICATION_CACHE)
		private readonly cache: NotificationCachePort,
	) {}

	async execute(userId: string): Promise<number> {
		return this.cache.wrapUnreadCount(userId, () =>
			this.notificationRepository.countUnread(userId),
		);
	}
}
