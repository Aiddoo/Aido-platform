import { Inject, Injectable, Logger } from "@nestjs/common";

import { NOTIFICATION_CACHE, type NotificationCachePort } from "../ports/notification-cache.port";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../ports/notification.repository.port";

/** auth purge가 소비하는 알림 bounded context의 개인정보 정리 capability입니다. */
export interface NotificationAccountCleanupResult {
	affectedUserIds: string[];
}

@Injectable()
export class NotificationAccountCleanup {
	readonly #logger = new Logger(NotificationAccountCleanup.name);

	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly repository: NotificationRepositoryPort,
		@Inject(NOTIFICATION_CACHE)
		private readonly cache: NotificationCachePort,
	) {}

	async cleanupInTransaction(userId: string): Promise<NotificationAccountCleanupResult> {
		const result = await this.repository.deleteNotificationsByActorId(userId);
		return { affectedUserIds: result.affectedUserIds };
	}

	async settleAfterCommit(result: NotificationAccountCleanupResult): Promise<void> {
		const settlements = await Promise.allSettled(
			result.affectedUserIds.map((userId) => this.cache.invalidateUnreadCount(userId)),
		);
		for (const [index, settlement] of settlements.entries()) {
			if (settlement.status === "rejected") {
				this.#logger.warn(
					`계정 정리 후 알림 캐시를 무효화하지 못했습니다: userId=${result.affectedUserIds[index]}`,
				);
			}
		}
	}
}
