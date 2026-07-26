import type { NotificationType } from "../../domain/types/notification-type";

export const NOTIFICATION_DEDUP = Symbol("NOTIFICATION_DEDUP");

export interface NotificationDedupRecord {
	readonly userId: string;
	readonly type: NotificationType;
	readonly notificationDate: Date;
}

/** Notification application이 사용하는 날짜별 발송 dedup 경계. */
export interface NotificationDedupPort {
	recordNotifiedUsers(records: NotificationDedupRecord[]): Promise<void>;
}
