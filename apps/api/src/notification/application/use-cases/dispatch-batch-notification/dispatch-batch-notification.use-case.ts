import { Inject, Injectable } from "@nestjs/common";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import {
	type PersistedBatchNotificationDispatch,
	PUSH_DISPATCHER,
	type PushDispatcherPort,
} from "../../ports/push-dispatcher.port";

/** 커밋된 배치 알림의 비동기 푸시·캐시·dedup 부수효과를 예약한다. */
@Injectable()
export class DispatchBatchNotificationUseCase {
	constructor(
		@Inject(PUSH_DISPATCHER)
		private readonly pushDispatcher: PushDispatcherPort,
		@Inject(NOTIFICATION_CACHE)
		private readonly cache: NotificationCachePort,
		@Inject(DEDUP_PROVIDER)
		private readonly dedupProvider: IDedupProvider,
	) {}

	execute(input: PersistedBatchNotificationDispatch): { count: number } {
		if (input.count === 0) {
			return { count: 0 };
		}

		this.pushDispatcher.fireAndForgetBatchPush(input.items);

		const uniqueUserIds = [
			...new Set(input.sourceData.map((data) => data.userId)),
		];
		void Promise.all(
			uniqueUserIds.map((userId) => this.cache.invalidateUnreadCount(userId)),
		);

		const groups = new Map<string, string[]>();
		for (const data of input.sourceData) {
			if (!data.notificationDate) continue;
			const key = DedupKeys.notified(data.type, data.notificationDate);
			const userIds = groups.get(key) ?? [];
			userIds.push(data.userId);
			groups.set(key, userIds);
		}
		void Promise.all(
			[...groups.entries()].map(([key, userIds]) =>
				this.dedupProvider.addMembers(
					key,
					[DedupKeys.SENTINEL, ...userIds],
					DedupKeys.TTL.NOTIFIED,
				),
			),
		);

		return { count: input.count };
	}
}
