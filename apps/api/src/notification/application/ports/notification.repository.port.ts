import type { NotificationRecord } from "../../domain/records/notification.record";
import type { CreateNotificationData } from "./notification-data";

/** 알림 저장소 포트 (DI 토큰) */
export const NOTIFICATION_REPOSITORY = Symbol("NOTIFICATION_REPOSITORY");

export class DuplicateNotificationError extends Error {
	constructor() {
		super("Notification already exists");
		this.name = "DuplicateNotificationError";
	}
}

/**
 * 알림 영속 상태 변경 포트.
 *
 * 어댑터(Prisma)는 CLS TransactionHost 기반으로 활성 트랜잭션에 참여한다.
 */
export interface NotificationRepositoryPort {
	createNotification(data: CreateNotificationData): Promise<NotificationRecord>;
	createManyNotificationsAndReturn(
		dataList: CreateNotificationData[],
	): Promise<NotificationRecord[]>;
	markAsRead(id: number, userId: string): Promise<boolean>;
	markAsOpened(id: number, userId: string): Promise<boolean>;
	markAllAsRead(userId: string): Promise<{ count: number }>;
	deleteNotificationsByActorId(
		actorId: string,
	): Promise<{ count: number; affectedUserIds: string[] }>;
}
