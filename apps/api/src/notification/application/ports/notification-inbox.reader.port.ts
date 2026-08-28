import type { NotificationRecord } from "../../domain/records/notification.record";
import type { FindNotificationsParams } from "./notification-data";

export const NOTIFICATION_INBOX_READER = Symbol("NOTIFICATION_INBOX_READER");

/** 알림함 화면과 읽음 처리에 필요한 조회 projection 포트. */
export interface NotificationInboxReaderPort {
	findNotificationById(id: number): Promise<NotificationRecord | null>;
	findNotificationsByUser(params: FindNotificationsParams): Promise<NotificationRecord[]>;
	countUnread(userId: string): Promise<number>;
}
