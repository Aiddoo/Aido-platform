import type { NotificationType } from "../../domain/types/notification-type";

export const NOTIFICATION_HISTORY_READER = Symbol("NOTIFICATION_HISTORY_READER");

export interface ExistsRecentNotificationQuery {
	readonly userId: string;
	readonly type: NotificationType;
	readonly since: Date;
	readonly friendId?: string;
	readonly todoId?: number;
	readonly nudgeId?: number;
	readonly cheerId?: number;
}

export interface FindAlreadyNotifiedUserIdsQuery {
	readonly userIds: string[];
	readonly type: NotificationType;
	readonly notificationDate: Date;
	readonly friendId?: string;
}

/** 중복 발송 판단에 필요한 알림 이력 조회 포트. */
export interface NotificationHistoryReaderPort {
	existsRecentNotification(query: ExistsRecentNotificationQuery): Promise<boolean>;
	findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>>;
}
