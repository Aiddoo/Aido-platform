import { Inject, Injectable, Logger } from "@nestjs/common";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { isUniqueConstraintViolation } from "@/shared/infrastructure/database/prisma-error.util";
import type { NotificationRecord } from "../../../domain/records/notification.record";
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
 * 알림 생성 및 푸시 발송 유스케이스.
 *
 * 1. DB에 알림 레코드 생성 (P2002 unique violation 시 graceful skip → null 반환)
 * 2. 사용자 푸시 설정 확인
 * 3. 설정에 따라 푸시 발송 (fire-and-forget)
 */
@Injectable()
export class SendNotificationUseCase {
	readonly #logger = new Logger(SendNotificationUseCase.name);

	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(PUSH_DISPATCHER)
		private readonly pushDispatcher: PushDispatcherPort,
		private readonly cacheService: CacheService,
	) {}

	async execute(
		data: CreateNotificationData,
	): Promise<NotificationRecord | null> {
		let notification: NotificationRecord;
		try {
			notification = await this.notificationRepository.createNotification(data);
		} catch (error) {
			if (isUniqueConstraintViolation(error)) {
				this.#logger.debug(
					`Notification dedup: unique constraint prevented duplicate ${data.type} for userId=${data.userId}`,
				);
				return null;
			}
			throw error;
		}

		const shouldSend = await this.pushDispatcher.shouldSendPush(
			data.userId,
			data.type,
			data.purpose,
		);

		if (!shouldSend) {
			this.#logger.debug(
				`Push notification skipped due to user settings: userId=${data.userId}, type=${data.type}`,
			);
			return notification;
		}

		this.pushDispatcher.fireAndForgetPush(data, notification.id);
		void this.cacheService.invalidateUnreadCount(data.userId);

		return notification;
	}
}
