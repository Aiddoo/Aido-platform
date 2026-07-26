import { Inject, Injectable } from "@nestjs/common";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import type { CreateNotificationData } from "../../ports/notification-data";
import type { PersistedBatchNotificationDispatch } from "../../ports/push-dispatcher.port";

/**
 * 배치 알림을 영속화하고 커밋 후 사용할 디스패치 입력을 반환한다.
 *
 * 푸시·캐시·Redis dedup 부수효과는 수행하지 않으므로 UOW 안에서 안전하게 호출할 수 있다.
 */
@Injectable()
export class PersistBatchNotificationUseCase {
	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
	) {}

	async execute(
		dataList: CreateNotificationData[],
	): Promise<PersistedBatchNotificationDispatch> {
		if (dataList.length === 0) {
			return { count: 0, items: [], sourceData: [] };
		}

		const created =
			await this.notificationRepository.createManyNotificationsAndReturn(
				dataList,
			);
		const forceKey = (userId: string, type: string): string =>
			`${userId}\u0000${type}`;
		const forcedKeys = new Set(
			dataList
				.filter((data) => data.force === true)
				.map((data) => forceKey(data.userId, data.type)),
		);

		return {
			count: created.length,
			items: created.map((notification) => ({
				data: {
					userId: notification.userId,
					type: notification.type,
					title: notification.title,
					body: notification.body,
					action: {
						type: notification.actionType,
						...(notification.actionUrl && { url: notification.actionUrl }),
					},
					todoId: notification.todoId,
					friendId: notification.friendId,
					nudgeId: notification.nudgeId,
					cheerId: notification.cheerId,
					purpose: notification.purpose,
					campaignKey: notification.campaignKey,
					variantId: notification.variantId,
					force: forcedKeys.has(
						forceKey(notification.userId, notification.type),
					),
				},
				notificationId: notification.id,
			})),
			sourceData: dataList,
		};
	}
}
