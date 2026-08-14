import { Inject, Injectable, Logger } from "@nestjs/common";

import type { NotificationRecord } from "../../../domain/records/notification.record";
import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import type { CreateNotificationData } from "../../ports/notification-data";
import {
	DuplicateNotificationError,
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import { PUSH_DISPATCHER, type PushDispatcherPort } from "../../ports/push-dispatcher.port";

/**
 * 알림 생성 및 푸시 발송 유스케이스.
 *
 * 1. DB에 알림 레코드 생성 (P2002 unique violation 시 graceful skip → null 반환)
 * 2. 푸시 디스패치 예약 (자격 판단·SKIPPED 기록은 디스패처가 담당)
 */
@Injectable()
export class SendNotificationUseCase {
	readonly #logger = new Logger(SendNotificationUseCase.name);

	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(PUSH_DISPATCHER)
		private readonly pushDispatcher: PushDispatcherPort,
		@Inject(NOTIFICATION_CACHE)
		private readonly cache: NotificationCachePort,
	) {}

	async execute(data: CreateNotificationData): Promise<NotificationRecord | null> {
		let notification: NotificationRecord;
		try {
			notification = await this.notificationRepository.createNotification(data);
		} catch (error) {
			if (error instanceof DuplicateNotificationError) {
				this.#logger.debug(
					`Notification dedup: unique constraint prevented duplicate ${data.type} for userId=${data.userId}`,
				);
				return null;
			}
			throw error;
		}

		this.pushDispatcher.fireAndForgetPush(data, notification.id);
		void this.cache.invalidateUnreadCount(data.userId);

		return notification;
	}
}
