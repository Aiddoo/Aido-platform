import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import {
	NOTIFICATION_DEDUP,
	type NotificationDedupPort,
} from "../../ports/notification-dedup.port";
import {
	type PersistedBatchNotificationDispatch,
	PUSH_DISPATCHER,
	type PushDispatcherPort,
} from "../../ports/push-dispatcher.port";

/** 커밋된 배치 알림의 비동기 푸시·캐시·dedup 부수효과를 예약한다. */
@Injectable()
export class DispatchBatchNotificationUseCase {
	readonly #logger = new Logger(DispatchBatchNotificationUseCase.name);

	constructor(
		@Inject(PUSH_DISPATCHER)
		private readonly pushDispatcher: PushDispatcherPort,
		@Inject(NOTIFICATION_CACHE)
		private readonly cache: NotificationCachePort,
		@Inject(NOTIFICATION_DEDUP)
		private readonly notificationDedup: NotificationDedupPort,
	) {}

	async execute(input: PersistedBatchNotificationDispatch): Promise<{ count: number }> {
		if (input.count === 0) {
			return { count: 0 };
		}

		this.pushDispatcher.fireAndForgetBatchPush(input.items);

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
