import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import {
	NOTIFICATION_DEDUP,
	type NotificationDedupPort,
} from "../../ports/notification-dedup.port";
import type { PersistedBatchNotificationResult } from "../../types/push-delivery.types";

/** 커밋된 배치 알림의 cache와 날짜 dedup 후처리를 관찰 가능한 방식으로 정리한다. */
@Injectable()
export class FinalizeBatchNotificationUseCase {
	readonly #logger = new Logger(FinalizeBatchNotificationUseCase.name);

	constructor(
		@Inject(NOTIFICATION_CACHE)
		private readonly cache: NotificationCachePort,
		@Inject(NOTIFICATION_DEDUP)
		private readonly notificationDedup: NotificationDedupPort,
	) {}

	async execute(input: PersistedBatchNotificationResult): Promise<{ count: number }> {
		if (input.count === 0) {
			return { count: 0 };
		}

		const uniqueUserIds = [...new Set(input.sourceData.map((data) => data.userId))];
		const sideEffects: Array<{ name: string; promise: Promise<unknown> }> = uniqueUserIds.map(
			(userId) => ({
				name: `invalidate unread count for userId=${userId}`,
				promise: this.cache.invalidateUnreadCount(userId),
			}),
		);
		sideEffects.push({
			name: "record notified recipients",
			promise: this.notificationDedup.recordNotifiedUsers(
				input.sourceData.flatMap((data) =>
					data.notificationDate
						? [
								{
									userId: data.userId,
									type: data.type,
									notificationDate: data.notificationDate,
								},
							]
						: [],
				),
			),
		});

		const results = await Promise.allSettled(sideEffects.map(({ promise }) => promise));
		results.forEach((result, index) => {
			if (result.status === "rejected") {
				this.#logger.warn(
					`Post-commit notification side effect failed: ${sideEffects[index]?.name}, ${result.reason}`,
				);
			}
		});

		return { count: input.count };
	}
}
