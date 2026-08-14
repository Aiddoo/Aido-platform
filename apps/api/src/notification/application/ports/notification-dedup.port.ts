import type { NotificationType } from "../../domain/types/notification-type";

export const NOTIFICATION_DEDUP = Symbol("NOTIFICATION_DEDUP");
export const NOTIFICATION_DEDUP_LOCK = Symbol("NOTIFICATION_DEDUP_LOCK");

export interface NotificationDedupRecord {
	readonly userId: string;
	readonly type: NotificationType;
	readonly notificationDate: Date;
}

/** Notification application이 사용하는 날짜별 발송 dedup 경계. */
export interface NotificationDedupPort {
	recordNotifiedUsers(records: NotificationDedupRecord[]): Promise<void>;
	readKnownRecipients(
		type: NotificationType,
		notificationDate: Date,
		userIds: readonly string[],
	): Promise<Set<string> | null>;
	warmRecipients(
		type: NotificationType,
		notificationDate: Date,
		userIds: readonly string[],
	): Promise<void>;
}

export interface NotificationDedupLockPort {
	acquire(dedupKey: string): Promise<(() => Promise<void>) | null>;
}
