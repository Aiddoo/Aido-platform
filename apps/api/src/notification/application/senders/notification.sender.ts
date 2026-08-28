import type { NotificationRecord } from "../../domain/records/notification.record";
import type { NotificationType } from "../../domain/types/notification-type";
import type { CreateNotificationData } from "../ports/notification-data";
import type { NotificationRecipientLocaleReaderPort } from "../ports/notification-recipient-locale.reader.port";
import type { FindAlreadyNotifiedUsersUseCase } from "../use-cases/find-already-notified-users/find-already-notified-users.use-case";
import type { SendBatchNotificationUseCase } from "../use-cases/send-batch-notification/send-batch-notification.use-case";
import type { SendNotificationWithDedupUseCase } from "../use-cases/send-notification-with-dedup/send-notification-with-dedup.use-case";
import type { SendNotificationUseCase } from "../use-cases/send-notification/send-notification.use-case";

/** 다른 모듈이 사용할 수 있는 알림 발송 및 중복 조회 capability. */
export class NotificationSender {
	constructor(
		private readonly sendNotificationUseCase: SendNotificationUseCase,
		private readonly sendNotificationWithDedupUseCase: SendNotificationWithDedupUseCase,
		private readonly sendBatchNotificationUseCase: SendBatchNotificationUseCase,
		private readonly findAlreadyNotifiedUsersUseCase: FindAlreadyNotifiedUsersUseCase,
		private readonly recipientLocaleReader: NotificationRecipientLocaleReaderPort,
	) {}

	createAndSend(data: CreateNotificationData): Promise<NotificationRecord | null> {
		return this.sendNotificationUseCase.execute(data);
	}

	createAndSendWithDedup(data: CreateNotificationData): Promise<NotificationRecord | null> {
		return this.sendNotificationWithDedupUseCase.execute(data);
	}

	createAndSendBatch(dataList: CreateNotificationData[]): Promise<{ count: number }> {
		return this.sendBatchNotificationUseCase.execute(dataList);
	}

	findAlreadyNotifiedUserIds(params: {
		userIds: string[];
		type: NotificationType;
		notificationDate: Date;
		friendId?: string;
	}): Promise<Set<string>> {
		return this.findAlreadyNotifiedUsersUseCase.execute(params);
	}

	getUserLocale(userId: string): ReturnType<NotificationRecipientLocaleReaderPort["getLocale"]> {
		return this.recipientLocaleReader.getLocale(userId);
	}
}
