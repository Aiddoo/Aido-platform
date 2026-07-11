import type {
	NotificationRecord,
	PushTokenRecord,
} from "../../domain/records/notification.record";
import type { NotificationType } from "../../domain/types/notification-type";
import type {
	CreateNotificationData,
	FindNotificationsParams,
	FindPushTokensParams,
	RegisterPushTokenData,
} from "./notification-data";

/** 알림 저장소 포트 (DI 토큰) */
export const NOTIFICATION_REPOSITORY = Symbol("NOTIFICATION_REPOSITORY");

/**
 * 알림·푸시 토큰 저장소 포트.
 *
 * 어댑터(Prisma)는 CLS TransactionHost 기반으로 활성 트랜잭션에 참여한다.
 */
export interface NotificationRepositoryPort {
	// --- Notification ---
	createNotification(data: CreateNotificationData): Promise<NotificationRecord>;
	createManyNotifications(
		dataList: CreateNotificationData[],
	): Promise<{ count: number }>;
	findNotificationById(id: number): Promise<NotificationRecord | null>;
	findNotificationsByUser(
		params: FindNotificationsParams,
	): Promise<NotificationRecord[]>;
	markAsRead(id: number): Promise<NotificationRecord>;
	markAllAsRead(userId: string): Promise<{ count: number }>;
	countUnread(userId: string): Promise<number>;
	deleteOldNotifications(daysOld?: number): Promise<{ count: number }>;
	existsRecentNotification(params: {
		userId: string;
		type: NotificationType;
		since: Date;
		friendId?: string;
		todoId?: number;
		nudgeId?: number;
		cheerId?: number;
	}): Promise<boolean>;
	findAlreadyNotifiedUserIds(params: {
		userIds: string[];
		type: NotificationType;
		notificationDate: Date;
		friendId?: string;
	}): Promise<Set<string>>;

	// --- PushToken ---
	registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord>;
	findPushTokensByUser(
		params: FindPushTokensParams,
	): Promise<PushTokenRecord[]>;
	findActivePushTokensByUsers(userIds: string[]): Promise<PushTokenRecord[]>;
	deletePushToken(userId: string, deviceId: string): Promise<PushTokenRecord>;
	deleteAllPushTokensByUser(userId: string): Promise<{ count: number }>;
	deactivateInvalidTokens(tokens: string[]): Promise<{ count: number }>;
}
