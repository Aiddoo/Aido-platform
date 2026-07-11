import { Inject, Injectable } from "@nestjs/common";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import type { CreateNotificationData } from "../../ports/notification-data";
import {
	PUSH_DISPATCHER,
	type PushDispatcherPort,
} from "../../ports/push-dispatcher.port";

/**
 * 여러 사용자에게 알림 생성 및 발송 유스케이스.
 *
 * DB 성공 후 Redis에 기록 (순서 보장):
 * DB 실패 시 addMembers에 도달하지 않으므로 불일치 방지
 */
@Injectable()
export class SendBatchNotificationUseCase {
	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(PUSH_DISPATCHER)
		private readonly pushDispatcher: PushDispatcherPort,
		private readonly cacheService: CacheService,
		@Inject(DEDUP_PROVIDER)
		private readonly dedupProvider: IDedupProvider,
	) {}

	async execute(
		dataList: CreateNotificationData[],
	): Promise<{ count: number }> {
		if (dataList.length === 0) {
			return { count: 0 };
		}

		// 1. DB 먼저 (최종 방어선 — unique index)
		const result =
			await this.notificationRepository.createManyNotifications(dataList);

		// 2. 푸시 발송 + unread count 무효화
		this.pushDispatcher.fireAndForgetBatchPush(dataList);

		const uniqueUserIds = [...new Set(dataList.map((d) => d.userId))];
		void Promise.all(
			uniqueUserIds.map((uid) => this.cacheService.invalidateUnreadCount(uid)),
		);

		// 3. DB 성공 확인 후 Redis에 기록 (fire-and-forget)
		const groups = new Map<string, string[]>();
		for (const d of dataList) {
			if (!d.notificationDate) continue;
			const key = DedupKeys.notified(d.type, d.notificationDate);
			const arr = groups.get(key) ?? [];
			arr.push(d.userId);
			groups.set(key, arr);
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

		return result;
	}
}
