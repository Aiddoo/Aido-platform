import { Inject, Injectable } from "@nestjs/common";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";

/**
 * 읽지 않은 알림 수 조회 유스케이스 (2분 캐시).
 */
@Injectable()
export class GetUnreadCountUseCase {
	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		private readonly cacheService: CacheService,
	) {}

	async execute(userId: string): Promise<number> {
		return this.cacheService.wrapUnreadCount(userId, () =>
			this.notificationRepository.countUnread(userId),
		);
	}
}
