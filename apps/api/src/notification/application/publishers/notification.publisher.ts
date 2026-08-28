import type { NotificationRecord } from "../../domain/records/notification.record";
import type { CreateNotificationData } from "../ports/notification-data";
import type { SendBatchNotificationUseCase } from "../use-cases/send-batch-notification/send-batch-notification.use-case";
import type { SendNotificationWithDedupUseCase } from "../use-cases/send-notification-with-dedup/send-notification-with-dedup.use-case";
import type { SendNotificationUseCase } from "../use-cases/send-notification/send-notification.use-case";

/** 다른 모듈에 노출하는 알림 발행 capability. */
export class NotificationPublisher {
	constructor(
		private readonly sendNotification: SendNotificationUseCase,
		private readonly sendNotificationWithDeduplication: SendNotificationWithDedupUseCase,
		private readonly sendBatchNotification: SendBatchNotificationUseCase,
	) {}

	publish(data: CreateNotificationData): Promise<NotificationRecord | null> {
		return this.sendNotification.execute(data);
	}

	publishWithDeduplication(data: CreateNotificationData): Promise<NotificationRecord | null> {
		return this.sendNotificationWithDeduplication.execute(data);
	}

	publishBatch(items: CreateNotificationData[]): Promise<{ count: number }> {
		return this.sendBatchNotification.execute(items);
	}
}
