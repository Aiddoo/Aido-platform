import { Injectable, Logger } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type {
	Notification,
	NotificationType,
	PushToken,
} from "@/generated/prisma/client";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { now } from "@/shared/domain/date/utils/core";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	CreateNotificationData,
	FindNotificationsParams,
	FindPushTokensParams,
	NotificationWithRelations,
	PushTokenWithRelations,
	RegisterPushTokenData,
} from "./types/notification.types";

@Injectable()
export class NotificationRepository {
	readonly #logger = new Logger(NotificationRepository.name);

	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	/**
	 * 알림 생성
	 */
	async createNotification(
		data: CreateNotificationData,
	): Promise<Notification> {
		return this.client.notification.create({
			data: {
				userId: data.userId,
				type: data.type,
				title: data.title,
				body: data.body,
				todoId: data.todoId,
				friendId: data.friendId,
				nudgeId: data.nudgeId,
				cheerId: data.cheerId,
				// metadata가 null이면 undefined로 변환 (Prisma에서 null 직접 할당 불가)
				metadata: data.metadata ?? undefined,
				notificationDate: data.notificationDate ?? undefined,
			},
		});
	}

	/**
	 * 여러 알림 일괄 생성
	 */
	async createManyNotifications(
		dataList: CreateNotificationData[],
	): Promise<{ count: number }> {
		const result = await this.client.notification.createMany({
			data: dataList.map((data) => ({
				userId: data.userId,
				type: data.type,
				title: data.title,
				body: data.body,
				todoId: data.todoId,
				friendId: data.friendId,
				nudgeId: data.nudgeId,
				cheerId: data.cheerId,
				// metadata가 null이면 undefined로 변환 (Prisma에서 null 직접 할당 불가)
				metadata: data.metadata ?? undefined,
				notificationDate: data.notificationDate ?? undefined,
			})),
			skipDuplicates: true,
		});

		const skipped = dataList.length - result.count;
		if (skipped > 0) {
			this.#logger.warn(
				`createManyNotifications: ${skipped}/${dataList.length} duplicates skipped`,
			);
		}

		return result;
	}

	/**
	 * ID로 알림 조회
	 */
	async findNotificationById(
		id: number,
	): Promise<NotificationWithRelations | null> {
		return this.client.notification.findUnique({
			where: { id },
		});
	}

	/**
	 * 사용자의 알림 목록 조회 (커서 기반 페이지네이션)
	 */
	async findNotificationsByUser(
		params: FindNotificationsParams,
	): Promise<NotificationWithRelations[]> {
		const { userId, cursor, size, unreadOnly, types } = params;

		return this.client.notification.findMany({
			where: {
				userId,
				...(unreadOnly && { isRead: false }),
				...(types && types.length > 0 && { type: { in: types } }),
			},
			take: size + 1, // 다음 페이지 존재 여부 확인용
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
	}

	/**
	 * 알림 읽음 처리
	 */
	async markAsRead(id: number): Promise<Notification> {
		return this.client.notification.update({
			where: { id },
			data: {
				isRead: true,
				readAt: now(),
			},
		});
	}

	/**
	 * 사용자의 모든 알림 읽음 처리
	 */
	async markAllAsRead(userId: string): Promise<{ count: number }> {
		return this.client.notification.updateMany({
			where: {
				userId,
				isRead: false,
			},
			data: {
				isRead: true,
				readAt: now(),
			},
		});
	}

	/**
	 * 읽지 않은 알림 수 조회
	 */
	async countUnread(userId: string): Promise<number> {
		return this.client.notification.count({
			where: {
				userId,
				isRead: false,
			},
		});
	}

	/**
	 * 알림 삭제
	 */
	async deleteNotification(id: number): Promise<Notification> {
		return this.client.notification.delete({
			where: { id },
		});
	}

	/**
	 * 오래된 알림 일괄 삭제 (90일 이상)
	 */
	async deleteOldNotifications(
		daysOld: number = 90,
	): Promise<{ count: number }> {
		const cutoffDate = subtractDays(daysOld);

		return this.client.notification.deleteMany({
			where: {
				createdAt: {
					lt: cutoffDate,
				},
			},
		});
	}

	/**
	 * 특정 타입 + notificationDate 조합의 알림 존재 여부 확인
	 * - DAILY_COMPLETE 중복 방지용 (단건)
	 */
	async existsNotification(params: {
		userId: string;
		type: NotificationType;
		notificationDate: Date;
	}): Promise<boolean> {
		const count = await this.client.notification.count({
			where: {
				userId: params.userId,
				type: params.type,
				notificationDate: params.notificationDate,
			},
		});
		return count > 0;
	}

	/**
	 * 지정 기간 내 동일 조건 알림 존재 여부 확인
	 * - nullable 타입 (NUDGE, CHEER, FOLLOW 등) 서비스 레이어 dedup용
	 */
	async existsRecentNotification(params: {
		userId: string;
		type: NotificationType;
		since: Date;
		friendId?: string;
		todoId?: number;
		nudgeId?: number;
		cheerId?: number;
	}): Promise<boolean> {
		const where: Record<string, unknown> = {
			userId: params.userId,
			type: params.type,
			createdAt: { gte: params.since },
		};
		if (params.friendId !== undefined) where.friendId = params.friendId;
		if (params.todoId !== undefined) where.todoId = params.todoId;
		if (params.nudgeId !== undefined) where.nudgeId = params.nudgeId;
		if (params.cheerId !== undefined) where.cheerId = params.cheerId;

		const count = await this.client.notification.count({ where });
		return count > 0;
	}

	/**
	 * metadata JSON 경로 기반 알림 존재 여부 확인
	 * - WINBACK 단계별 중복 방지용
	 */
	async existsNotificationWithMetadata(params: {
		userId: string;
		type: NotificationType;
		metadataPath: string[];
		metadataValue: string;
	}): Promise<boolean> {
		const count = await this.client.notification.count({
			where: {
				userId: params.userId,
				type: params.type,
				metadata: {
					path: params.metadataPath,
					equals: params.metadataValue,
				},
			},
		});
		return count > 0;
	}

	/**
	 * 이미 알림을 받은 사용자 ID 목록 조회 (배치)
	 * - FRIEND_COMPLETED / MORNING_REMINDER / EVENING_REMINDER 중복 방지용
	 * - N+1 방지를 위해 단일 쿼리로 처리
	 */
	async findAlreadyNotifiedUserIds(params: {
		userIds: string[];
		type: NotificationType;
		notificationDate: Date;
		friendId?: string;
	}): Promise<Set<string>> {
		const rows = await this.client.notification.findMany({
			where: {
				userId: { in: params.userIds },
				type: params.type,
				...(params.friendId && { friendId: params.friendId }),
				notificationDate: params.notificationDate,
			},
			select: { userId: true },
			distinct: ["userId"],
		});
		return new Set(rows.map((r) => r.userId));
	}

	/**
	 * 푸시 토큰 등록 (upsert)
	 */
	async registerPushToken(data: RegisterPushTokenData): Promise<PushToken> {
		// deviceId가 없으면 기본값 사용
		const deviceId = data.deviceId ?? "default";
		const platform = data.platform ?? "IOS";

		return this.client.pushToken.upsert({
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
				updatedAt: now(),
			},
		});
	}

	/**
	 * 토큰 값으로 푸시 토큰 조회
	 */
	async findPushTokenByToken(
		token: string,
	): Promise<PushTokenWithRelations | null> {
		return this.client.pushToken.findFirst({
			where: { token },
		});
	}

	/**
	 * 사용자의 푸시 토큰 목록 조회
	 */
	async findPushTokensByUser(
		params: FindPushTokensParams,
	): Promise<PushTokenWithRelations[]> {
		const { userId, activeOnly } = params;

		return this.client.pushToken.findMany({
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
	): Promise<PushTokenWithRelations[]> {
		return this.client.pushToken.findMany({
			where: {
				userId: { in: userIds },
				isActive: true,
			},
		});
	}

	/**
	 * 푸시 토큰 비활성화
	 * @returns 비활성화된 토큰 수
	 */
	async deactivatePushToken(token: string): Promise<number> {
		const result = await this.client.pushToken.updateMany({
			where: { token },
			data: { isActive: false },
		});

		return result.count;
	}

	/**
	 * 사용자의 특정 디바이스 푸시 토큰 삭제
	 */
	async deletePushToken(userId: string, deviceId: string): Promise<PushToken> {
		return this.client.pushToken.delete({
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
	async deleteAllPushTokensByUser(userId: string): Promise<{ count: number }> {
		return this.client.pushToken.deleteMany({
			where: { userId },
		});
	}

	/**
	 * 잘못된 토큰들 일괄 비활성화
	 */
	async deactivateInvalidTokens(tokens: string[]): Promise<{ count: number }> {
		return this.client.pushToken.updateMany({
			where: {
				token: { in: tokens },
			},
			data: { isActive: false },
		});
	}
}
