import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/database/database.service";
import type { Notification, PushToken } from "@/generated/prisma/client";

import type {
	CreateNotificationData,
	FindNotificationsParams,
	FindPushTokensParams,
	NotificationWithRelations,
	PushTokenWithRelations,
	RegisterPushTokenData,
	TransactionClient,
} from "./types/notification.types";

// =============================================================================
// Repository
// =============================================================================

@Injectable()
export class NotificationRepository {
	constructor(private readonly database: DatabaseService) {}

	// =========================================================================
	// Notification CRUD
	// =========================================================================

	/**
	 * 알림 생성
	 */
	async createNotification(
		data: CreateNotificationData,
		tx?: TransactionClient,
	): Promise<Notification> {
		const client = tx ?? this.database;
		return client.notification.create({
			data: {
				userId: data.userId,
				type: data.type,
				title: data.title,
				body: data.body,
				route: data.route,
				todoId: data.todoId,
				friendId: data.friendId,
				nudgeId: data.nudgeId,
				cheerId: data.cheerId,
				// metadata가 null이면 undefined로 변환 (Prisma에서 null 직접 할당 불가)
				metadata: data.metadata ?? undefined,
			},
		});
	}

	/**
	 * 여러 알림 일괄 생성
	 */
	async createManyNotifications(
		dataList: CreateNotificationData[],
		tx?: TransactionClient,
	): Promise<{ count: number }> {
		const client = tx ?? this.database;
		return client.notification.createMany({
			data: dataList.map((data) => ({
				userId: data.userId,
				type: data.type,
				title: data.title,
				body: data.body,
				route: data.route,
				todoId: data.todoId,
				friendId: data.friendId,
				nudgeId: data.nudgeId,
				cheerId: data.cheerId,
				// metadata가 null이면 undefined로 변환 (Prisma에서 null 직접 할당 불가)
				metadata: data.metadata ?? undefined,
			})),
		});
	}

	/**
	 * ID로 알림 조회
	 */
	async findNotificationById(
		id: number,
		tx?: TransactionClient,
	): Promise<NotificationWithRelations | null> {
		const client = tx ?? this.database;
		return client.notification.findUnique({
			where: { id },
		});
	}

	/**
	 * 사용자의 알림 목록 조회 (커서 기반 페이지네이션)
	 */
	async findNotificationsByUser(
		params: FindNotificationsParams,
		tx?: TransactionClient,
	): Promise<NotificationWithRelations[]> {
		const { userId, cursor, size, unreadOnly } = params;
		const client = tx ?? this.database;

		return client.notification.findMany({
			where: {
				userId,
				...(unreadOnly && { isRead: false }),
			},
			take: size + 1, // 다음 페이지 존재 여부 확인용
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * 알림 읽음 처리
	 */
	async markAsRead(id: number, tx?: TransactionClient): Promise<Notification> {
		const client = tx ?? this.database;
		return client.notification.update({
			where: { id },
			data: {
				isRead: true,
				readAt: new Date(),
			},
		});
	}

	/**
	 * 사용자의 모든 알림 읽음 처리
	 */
	async markAllAsRead(
		userId: string,
		tx?: TransactionClient,
	): Promise<{ count: number }> {
		const client = tx ?? this.database;
		return client.notification.updateMany({
			where: {
				userId,
				isRead: false,
			},
			data: {
				isRead: true,
				readAt: new Date(),
			},
		});
	}

	/**
	 * 읽지 않은 알림 수 조회
	 */
	async countUnread(userId: string, tx?: TransactionClient): Promise<number> {
		const client = tx ?? this.database;
		return client.notification.count({
			where: {
				userId,
				isRead: false,
			},
		});
	}

	/**
	 * 알림 삭제
	 */
	async deleteNotification(
		id: number,
		tx?: TransactionClient,
	): Promise<Notification> {
		const client = tx ?? this.database;
		return client.notification.delete({
			where: { id },
		});
	}

	/**
	 * 오래된 알림 일괄 삭제 (90일 이상)
	 */
	async deleteOldNotifications(
		daysOld: number = 90,
		tx?: TransactionClient,
	): Promise<{ count: number }> {
		const client = tx ?? this.database;
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysOld);

		return client.notification.deleteMany({
			where: {
				createdAt: {
					lt: cutoffDate,
				},
			},
		});
	}

	// =========================================================================
	// PushToken CRUD
	// =========================================================================

	/**
	 * 푸시 토큰 등록 (upsert)
	 */
	async registerPushToken(
		data: RegisterPushTokenData,
		tx?: TransactionClient,
	): Promise<PushToken> {
		const client = tx ?? this.database;

		// deviceId가 없으면 기본값 사용
		const deviceId = data.deviceId ?? "default";
		const platform = data.platform ?? "IOS";

		return client.pushToken.upsert({
			where: {
				userId_deviceId: {
					userId: data.userId,
					deviceId,
				},
			},
			create: {
				userId: data.userId,
				token: data.token,
				deviceId,
				platform,
				isActive: true,
			},
			update: {
				token: data.token,
				platform,
				isActive: true,
				updatedAt: new Date(),
			},
		});
	}

	/**
	 * 토큰 값으로 푸시 토큰 조회
	 */
	async findPushTokenByToken(
		token: string,
		tx?: TransactionClient,
	): Promise<PushTokenWithRelations | null> {
		const client = tx ?? this.database;
		return client.pushToken.findFirst({
			where: { token },
		});
	}

	/**
	 * 사용자의 푸시 토큰 목록 조회
	 */
	async findPushTokensByUser(
		params: FindPushTokensParams,
		tx?: TransactionClient,
	): Promise<PushTokenWithRelations[]> {
		const { userId, activeOnly } = params;
		const client = tx ?? this.database;

		return client.pushToken.findMany({
			where: {
				userId,
				...(activeOnly && { isActive: true }),
			},
			orderBy: { updatedAt: "desc" },
		});
	}

	/**
	 * 여러 사용자의 활성 푸시 토큰 조회
	 */
	async findActivePushTokensByUsers(
		userIds: string[],
		tx?: TransactionClient,
	): Promise<PushTokenWithRelations[]> {
		const client = tx ?? this.database;
		return client.pushToken.findMany({
			where: {
				userId: { in: userIds },
				isActive: true,
			},
		});
	}

	/**
	 * 푸시 토큰 비활성화
	 */
	async deactivatePushToken(
		token: string,
		tx?: TransactionClient,
	): Promise<PushToken | null> {
		const client = tx ?? this.database;

		const existing = await client.pushToken.findFirst({
			where: { token },
		});

		if (!existing) {
			return null;
		}

		return client.pushToken.update({
			where: { id: existing.id },
			data: { isActive: false },
		});
	}

	/**
	 * 사용자의 특정 디바이스 푸시 토큰 삭제
	 */
	async deletePushToken(
		userId: string,
		deviceId: string,
		tx?: TransactionClient,
	): Promise<PushToken> {
		const client = tx ?? this.database;
		return client.pushToken.delete({
			where: {
				userId_deviceId: {
					userId,
					deviceId,
				},
			},
		});
	}

	/**
	 * 사용자의 모든 푸시 토큰 삭제
	 */
	async deleteAllPushTokensByUser(
		userId: string,
		tx?: TransactionClient,
	): Promise<{ count: number }> {
		const client = tx ?? this.database;
		return client.pushToken.deleteMany({
			where: { userId },
		});
	}

	/**
	 * 잘못된 토큰들 일괄 비활성화
	 */
	async deactivateInvalidTokens(
		tokens: string[],
		tx?: TransactionClient,
	): Promise<{ count: number }> {
		const client = tx ?? this.database;
		return client.pushToken.updateMany({
			where: {
				token: { in: tokens },
			},
			data: { isActive: false },
		});
	}
}
