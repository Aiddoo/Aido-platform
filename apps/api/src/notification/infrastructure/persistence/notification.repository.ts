import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable, Logger } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { now } from "@/shared/domain/date/utils/core";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { toInputJson } from "@/shared/infrastructure/database/json.util";
import {
	isRecordNotFoundError,
	isUniqueConstraintViolation,
} from "@/shared/infrastructure/database/prisma-error.util";

import type {
	CreateNotificationData,
	FindNotificationsParams,
	FindPushTokensParams,
	NotificationWithRelations,
	PushTokenWithRelations,
	RegisterPushTokenData,
} from "../../application/ports/notification-data";
import type {
	CreatePushDispatchInput,
	NotificationRepositoryPort,
	PushDeliveryResultsInput,
	PushDispatchFailureReason,
	PushDispatchRecord,
	PushDispatchSkipReason,
	PushDispatchSkipUpdate,
} from "../../application/ports/notification.repository.port";
import {
	DuplicateNotificationError,
	PushTokenNotFoundError,
} from "../../application/ports/notification.repository.port";
import type { PushReceiptResult, PushResult } from "../../application/ports/push-provider.port";
import type { NotificationRecord, PushTokenRecord } from "../../domain/records/notification.record";
import type { NotificationType } from "../../domain/types/notification-type";

interface DeletedNotificationRecipientRow {
	userId: string;
}

@Injectable()
export class NotificationRepository implements NotificationRepositoryPort {
	readonly #logger = new Logger(NotificationRepository.name);

	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	/**
	 * 알림 생성
	 */
	async createNotification(data: CreateNotificationData): Promise<NotificationRecord> {
		try {
			return await this.client.notification.create({
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
					metadata: data.metadata != null ? toInputJson(data.metadata) : undefined,
					notificationDate: data.notificationDate ?? undefined,
					actionType: data.action?.type ?? "DEEP_LINK",
					actionUrl: data.action?.url,
					campaignKey: data.campaignKey,
					variantId: data.variantId,
					purpose: data.purpose ?? "TRANSACTIONAL",
				},
			});
		} catch (error) {
			if (isUniqueConstraintViolation(error)) {
				throw new DuplicateNotificationError();
			}
			throw error;
		}
	}

	/**
	 * 여러 알림 일괄 생성
	 */
	async createManyNotifications(dataList: CreateNotificationData[]): Promise<{ count: number }> {
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
				metadata: data.metadata != null ? toInputJson(data.metadata) : undefined,
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
	 * 실제 저장된 행만 반환한다. 배치 중복이 제거된 뒤의 ID를 푸시 페이로드에
	 * 사용하기 위한 outbox 진입점이다.
	 */
	async createManyNotificationsAndReturn(
		dataList: CreateNotificationData[],
	): Promise<NotificationRecord[]> {
		if (dataList.length === 0) return [];

		return this.client.notification.createManyAndReturn({
			data: dataList.map((data) => ({
				userId: data.userId,
				type: data.type,
				title: data.title,
				body: data.body,
				todoId: data.todoId,
				friendId: data.friendId,
				nudgeId: data.nudgeId,
				cheerId: data.cheerId,
				metadata: data.metadata != null ? toInputJson(data.metadata) : undefined,
				notificationDate: data.notificationDate ?? undefined,
				actionType: data.action?.type ?? "DEEP_LINK",
				actionUrl: data.action?.url,
				campaignKey: data.campaignKey,
				variantId: data.variantId,
				purpose: data.purpose ?? "TRANSACTIONAL",
			})),
			skipDuplicates: true,
		});
	}

	/**
	 * ID로 알림 조회
	 */
	async findNotificationById(id: number): Promise<NotificationWithRelations | null> {
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
	async markAsRead(id: number, userId: string): Promise<boolean> {
		const result = await this.client.notification.updateMany({
			where: { id, userId, isRead: false },
			data: {
				isRead: true,
				readAt: now(),
			},
		});
		return result.count > 0;
	}

	async markAsOpened(id: number, userId: string): Promise<boolean> {
		const openedAt = now();
		const result = await this.client.notification.updateMany({
			where: { id, userId, openedAt: null },
			data: { openedAt, isRead: true, readAt: openedAt },
		});
		if (result.count > 0) {
			await this.client.pushDispatch.updateMany({
				where: { notificationId: id, userId, openedAt: null },
				data: { openedAt },
			});
		}
		return result.count > 0;
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
	async deleteNotification(id: number): Promise<NotificationRecord> {
		return this.client.notification.delete({
			where: { id },
		});
	}

	/**
	 * 오래된 알림 일괄 삭제 (90일 이상)
	 */
	async deleteOldNotifications(daysOld: number = 90): Promise<{ count: number }> {
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
	 * 계정 hard delete 전에 다른 사용자의 알림에 복사된 발신자 개인정보를 제거합니다.
	 * friendId는 기존 소셜 알림, metadata.senderId는 댓글 활동 알림의 actor 식별자입니다.
	 */
	async deleteNotificationsByActorId(
		actorId: string,
	): Promise<{ count: number; affectedUserIds: string[] }> {
		const deletedRows = await this.client.$queryRaw<DeletedNotificationRecipientRow[]>(Prisma.sql`
			DELETE FROM "Notification"
			WHERE "friendId" = ${actorId}
				OR "metadata" ->> 'senderId' = ${actorId}
			RETURNING "userId"
		`);

		return {
			count: deletedRows.length,
			affectedUserIds: [...new Set(deletedRows.map((row) => row.userId))],
		};
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
	async registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord> {
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
				payloadVersion: data.payloadVersion ?? 1,
				appVersion: data.appVersion,
			},
			update: {
				token: data.token,
				platform,
				isActive: true,
				payloadVersion: data.payloadVersion ?? 1,
				appVersion: data.appVersion,
				updatedAt: now(),
			},
		});
	}

	async createPushDispatch(input: CreatePushDispatchInput): Promise<{ id: number }> {
		return this.client.pushDispatch.upsert({
			where: { notificationId: input.notificationId },
			create: { ...input, status: "PROCESSING" },
			update: { status: "PROCESSING", skipReason: null },
			select: { id: true },
		});
	}

	/**
	 * 한 번의 INSERT ... ON CONFLICT로 배치 dispatch를 생성하거나 재시도 상태로 복구한다.
	 * notificationId unique key가 멱등성을 보장하며 모든 입력 행을 반환한다.
	 */
	async createPushDispatches(inputs: CreatePushDispatchInput[]): Promise<PushDispatchRecord[]> {
		if (inputs.length === 0) return [];

		const values = inputs.map(
			(input) =>
				Prisma.sql`(
					${input.notificationId},
					${input.userId},
					${input.purpose}::"NotificationPurpose",
					${input.campaignKey ?? null},
					${input.variantId ?? null},
					${input.timezone},
					${input.localDate}::DATE,
					'PROCESSING'::"PushDispatchStatus",
					CURRENT_TIMESTAMP
				)`,
		);

		return this.client.$queryRaw<PushDispatchRecord[]>(Prisma.sql`
			INSERT INTO "PushDispatch" (
				"notificationId",
				"userId",
				"purpose",
				"campaignKey",
				"variantId",
				"timezone",
				"localDate",
				"status",
				"updatedAt"
			)
			VALUES ${Prisma.join(values)}
			ON CONFLICT ("notificationId")
			DO UPDATE SET
				"status" = 'PROCESSING'::"PushDispatchStatus",
				"skipReason" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			RETURNING "id", "notificationId"
		`);
	}

	async markPushDispatchSkipped(dispatchId: number, reason: PushDispatchSkipReason): Promise<void> {
		await this.client.pushDispatch.update({
			where: { id: dispatchId },
			data: { status: "SKIPPED", skipReason: reason },
		});
	}

	/**
	 * 사용자 수가 아니라 skip reason 종류 수만큼만 UPDATE를 실행한다.
	 * reason은 닫힌 union이라 최대 호출 수도 고정된다.
	 */
	async markPushDispatchesSkipped(updates: PushDispatchSkipUpdate[]): Promise<void> {
		const dispatchIdsByReason = new Map<PushDispatchSkipReason, number[]>();
		for (const update of updates) {
			const dispatchIds = dispatchIdsByReason.get(update.reason) ?? [];
			dispatchIds.push(update.dispatchId);
			dispatchIdsByReason.set(update.reason, dispatchIds);
		}

		await Promise.all(
			[...dispatchIdsByReason].map(([reason, dispatchIds]) =>
				this.client.pushDispatch.updateMany({
					where: { id: { in: dispatchIds } },
					data: { status: "SKIPPED", skipReason: reason },
				}),
			),
		);
	}

	async markPushDispatchFailed(
		dispatchIds: number[],
		reason: PushDispatchFailureReason,
	): Promise<void> {
		if (dispatchIds.length === 0) return;
		await this.client.pushDispatch.updateMany({
			where: { id: { in: dispatchIds }, status: "PROCESSING" },
			data: { status: "FAILED", skipReason: reason },
		});
	}

	async recordPushDeliveryResults(dispatchId: number, results: PushResult[]): Promise<void> {
		await this.recordPushDeliveryResultsBatch([{ dispatchId, results }]);
	}

	/**
	 * 모든 dispatch의 토큰 조회·attempt 생성·상태 전이를 고정된 수의 쿼리로 처리한다.
	 */
	async recordPushDeliveryResultsBatch(inputs: PushDeliveryResultsInput[]): Promise<void> {
		if (inputs.length === 0) return;

		const results = inputs.flatMap((input) => input.results);
		const tokens =
			results.length > 0
				? await this.client.pushToken.findMany({
						where: { token: { in: results.map((result) => result.token) } },
						select: { id: true, token: true },
					})
				: [];
		const tokenIdByValue = new Map(tokens.map((token) => [token.token, token.id]));
		const attempts = inputs.flatMap((input) =>
			input.results.flatMap((result) => {
				const pushTokenId = tokenIdByValue.get(result.token);
				if (!pushTokenId) return [];
				return [
					{
						dispatchId: input.dispatchId,
						pushTokenId,
						status: result.success ? ("TICKET_ACCEPTED" as const) : ("FAILED" as const),
						expoTicketId: result.ticketId,
						errorCode: result.errorCode,
						errorMessage: result.error?.slice(0, 500),
					},
				];
			}),
		);
		if (attempts.length > 0) {
			await this.client.pushDeliveryAttempt.createMany({
				data: attempts,
				skipDuplicates: true,
			});
		}

		const sentDispatchIds = inputs.flatMap((input) =>
			input.results.some((result) => result.success) ? [input.dispatchId] : [],
		);
		const failedDispatchIds = inputs.flatMap((input) =>
			input.results.some((result) => result.success) ? [] : [input.dispatchId],
		);
		if (sentDispatchIds.length > 0) {
			await this.client.pushDispatch.updateMany({
				where: { id: { in: sentDispatchIds } },
				data: { status: "SENT", sentAt: now() },
			});
		}
		if (failedDispatchIds.length > 0) {
			await this.client.pushDispatch.updateMany({
				where: { id: { in: failedDispatchIds } },
				data: { status: "FAILED" },
			});
		}
	}

	async findPendingPushReceipts(
		limit: number,
	): Promise<Array<{ ticketId: string; token: string }>> {
		const rows = await this.client.pushDeliveryAttempt.findMany({
			where: { status: "TICKET_ACCEPTED", expoTicketId: { not: null } },
			take: limit,
			orderBy: { createdAt: "asc" },
			select: { expoTicketId: true, pushToken: { select: { token: true } } },
		});
		return rows.flatMap((row) =>
			row.expoTicketId ? [{ ticketId: row.expoTicketId, token: row.pushToken.token }] : [],
		);
	}

	async recordPushReceipts(results: PushReceiptResult[]): Promise<string[]> {
		if (results.length === 0) return [];

		const receiptCheckedAt = now();
		const values = results.map(
			(result) =>
				Prisma.sql`(
					${result.ticketId}::VARCHAR(100),
					${result.delivered ? "DELIVERED" : "FAILED"}::"PushDeliveryStatus",
					${result.errorCode ?? null}::VARCHAR(100),
					${result.error?.slice(0, 500) ?? null}::VARCHAR(500)
				)`,
		);
		await this.client.$executeRaw(Prisma.sql`
			UPDATE "PushDeliveryAttempt" AS attempt
			SET
				"status" = receipt."status",
				"errorCode" = receipt."errorCode",
				"errorMessage" = receipt."errorMessage",
				"receiptCheckedAt" = ${receiptCheckedAt},
				"updatedAt" = ${receiptCheckedAt}
			FROM (
				VALUES ${Prisma.join(values)}
			) AS receipt("ticketId", "status", "errorCode", "errorMessage")
			WHERE attempt."expoTicketId" = receipt."ticketId"
		`);

		const invalidTicketIds: string[] = [];
		for (const result of results) {
			if (result.errorCode === "DeviceNotRegistered") {
				invalidTicketIds.push(result.ticketId);
			}
		}
		if (invalidTicketIds.length === 0) return [];
		const attempts = await this.client.pushDeliveryAttempt.findMany({
			where: { expoTicketId: { in: invalidTicketIds } },
			select: { pushToken: { select: { token: true } } },
		});
		return attempts.map((attempt) => attempt.pushToken.token);
	}

	/**
	 * 토큰 값으로 푸시 토큰 조회
	 */
	async findPushTokenByToken(token: string): Promise<PushTokenWithRelations | null> {
		return this.client.pushToken.findFirst({
			where: { token },
		});
	}

	/**
	 * 사용자의 푸시 토큰 목록 조회
	 */
	async findPushTokensByUser(params: FindPushTokensParams): Promise<PushTokenWithRelations[]> {
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
	async findActivePushTokensByUsers(userIds: string[]): Promise<PushTokenWithRelations[]> {
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
	async deletePushToken(userId: string, deviceId: string): Promise<PushTokenRecord> {
		try {
			return await this.client.pushToken.delete({
				where: {
					userId_deviceId: {
						userId,
						deviceId,
					},
				},
			});
		} catch (error) {
			if (isRecordNotFoundError(error)) {
				throw new PushTokenNotFoundError();
			}
			throw error;
		}
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
