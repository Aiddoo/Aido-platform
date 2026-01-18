import type { Notification as NotificationDto } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginatedResponse } from "@/common/pagination/interfaces/pagination.interface";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import type { Notification, PushToken } from "@/generated/prisma/client";

import { NotificationMapper } from "./notification.mapper";
import { NotificationRepository } from "./notification.repository";
import {
	PUSH_PROVIDER,
	type PushPayload,
	type PushProvider,
} from "./providers/push-provider.interface";
import type {
	CreateNotificationData,
	FindNotificationsParams,
	RegisterPushTokenData,
} from "./types/notification.types";

// =============================================================================
// Service
// =============================================================================

/**
 * 알림 서비스
 *
 * - 푸시 토큰 등록/해제
 * - 알림 생성 및 푸시 발송
 * - 알림 목록 조회 (커서 기반 페이지네이션)
 * - 읽음 처리
 */
@Injectable()
export class NotificationService {
	private readonly logger = new Logger(NotificationService.name);

	constructor(
		private readonly notificationRepository: NotificationRepository,
		private readonly paginationService: PaginationService,
		@Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
	) {}

	// =========================================================================
	// 푸시 토큰 관리
	// =========================================================================

	/**
	 * 푸시 토큰 등록
	 */
	async registerPushToken(data: RegisterPushTokenData): Promise<PushToken> {
		// 토큰 유효성 검증
		if (!this.pushProvider.validateToken(data.token)) {
			throw BusinessExceptions.invalidPushToken(data.token);
		}

		const pushToken = await this.notificationRepository.registerPushToken(data);

		this.logger.log(
			`Push token registered: userId=${data.userId}, deviceId=${data.deviceId}`,
		);

		return pushToken;
	}

	/**
	 * 푸시 토큰 해제
	 */
	async unregisterPushToken(userId: string, deviceId: string): Promise<void> {
		try {
			await this.notificationRepository.deletePushToken(userId, deviceId);
			this.logger.log(
				`Push token unregistered: userId=${userId}, deviceId=${deviceId}`,
			);
		} catch (_error) {
			// 토큰이 없는 경우 무시
			this.logger.warn(
				`Push token not found for unregister: userId=${userId}, deviceId=${deviceId}`,
			);
		}
	}

	/**
	 * 사용자의 모든 푸시 토큰 해제 (로그아웃 등)
	 */
	async unregisterAllPushTokens(userId: string): Promise<void> {
		const result =
			await this.notificationRepository.deleteAllPushTokensByUser(userId);
		this.logger.log(
			`All push tokens unregistered: userId=${userId}, count=${result.count}`,
		);
	}

	// =========================================================================
	// 알림 생성 및 발송
	// =========================================================================

	/**
	 * 알림 생성 및 푸시 발송
	 *
	 * 1. DB에 알림 레코드 생성
	 * 2. 사용자의 활성 푸시 토큰 조회
	 * 3. 푸시 알림 발송
	 * 4. 실패한 토큰 비활성화
	 */
	async createAndSend(data: CreateNotificationData): Promise<Notification> {
		// 1. DB에 알림 생성
		const notification =
			await this.notificationRepository.createNotification(data);

		// 2. 푸시 발송 (비동기, 에러 발생해도 알림 생성은 성공)
		this.sendPushToUser(data.userId, {
			title: data.title,
			body: data.body,
			data: {
				notificationId: notification.id,
				type: data.type,
				route: data.route,
			},
		}).catch((error) => {
			this.logger.error(
				`Failed to send push notification: userId=${data.userId}, error=${error}`,
			);
		});

		return notification;
	}

	/**
	 * 여러 사용자에게 알림 생성 및 발송
	 */
	async createAndSendBatch(
		dataList: CreateNotificationData[],
	): Promise<{ count: number }> {
		if (dataList.length === 0) {
			return { count: 0 };
		}

		// 1. DB에 알림 일괄 생성
		const result =
			await this.notificationRepository.createManyNotifications(dataList);

		// 2. 고유 사용자 ID 추출
		const userIds = [...new Set(dataList.map((d) => d.userId))];

		// 3. 푸시 발송 (비동기, 에러 발생해도 알림 생성은 성공)
		this.sendPushToUsers(
			userIds,
			dataList.map((d) => ({
				userId: d.userId,
				title: d.title,
				body: d.body,
				data: {
					type: d.type,
					route: d.route,
				},
			})),
		).catch((error) => {
			this.logger.error(
				`Failed to send batch push notifications: userIds=${userIds.join(",")}, error=${error}`,
			);
		});

		return result;
	}

	/**
	 * 알림만 생성 (푸시 발송 없이)
	 */
	async createOnly(data: CreateNotificationData): Promise<Notification> {
		return this.notificationRepository.createNotification(data);
	}

	// =========================================================================
	// 알림 조회
	// =========================================================================

	/**
	 * 알림 목록 조회 (커서 기반 페이지네이션)
	 */
	async getNotifications(params: {
		userId: string;
		cursor?: number;
		size?: number;
		unreadOnly?: boolean;
	}): Promise<CursorPaginatedResponse<NotificationDto, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const repoParams: FindNotificationsParams = {
			userId: params.userId,
			cursor,
			size,
			unreadOnly: params.unreadOnly,
		};

		const notifications =
			await this.notificationRepository.findNotificationsByUser(repoParams);

		this.logger.debug(
			`Notifications listed: ${notifications.length} items for user: ${params.userId}`,
		);

		// DTO 변환
		const dtoItems = NotificationMapper.toDtoList(notifications);

		return this.paginationService.createCursorPaginatedResponse<
			NotificationDto,
			number
		>({
			items: dtoItems,
			size,
		});
	}

	/**
	 * 읽지 않은 알림 수 조회
	 */
	async getUnreadCount(userId: string): Promise<number> {
		return this.notificationRepository.countUnread(userId);
	}

	// =========================================================================
	// 읽음 처리
	// =========================================================================

	/**
	 * 단일 알림 읽음 처리
	 */
	async markAsRead(userId: string, notificationId: number): Promise<void> {
		// 알림 존재 및 소유권 확인
		const notification =
			await this.notificationRepository.findNotificationById(notificationId);

		if (!notification) {
			throw BusinessExceptions.notificationNotFound(notificationId);
		}

		if (notification.userId !== userId) {
			throw BusinessExceptions.notificationAccessDenied(notificationId);
		}

		// 이미 읽은 경우 무시
		if (notification.isRead) {
			return;
		}

		await this.notificationRepository.markAsRead(notificationId);

		this.logger.debug(`Notification marked as read: id=${notificationId}`);
	}

	/**
	 * 모든 알림 읽음 처리
	 */
	async markAllAsRead(userId: string): Promise<{ count: number }> {
		const result = await this.notificationRepository.markAllAsRead(userId);

		this.logger.debug(
			`All notifications marked as read: userId=${userId}, count=${result.count}`,
		);

		return result;
	}

	// =========================================================================
	// 푸시 발송 (Private)
	// =========================================================================

	/**
	 * 특정 사용자에게 푸시 발송
	 */
	private async sendPushToUser(
		userId: string,
		payload: Omit<PushPayload, "token">,
	): Promise<void> {
		const tokens = await this.notificationRepository.findPushTokensByUser({
			userId,
			activeOnly: true,
		});

		if (tokens.length === 0) {
			this.logger.debug(`No active push tokens for user: ${userId}`);
			return;
		}

		const payloads: PushPayload[] = tokens.map((t) => ({
			...payload,
			token: t.token,
		}));

		const result = await this.pushProvider.sendBatch(payloads);

		// 잘못된 토큰 비활성화
		if (result.invalidTokens.length > 0) {
			await this.notificationRepository.deactivateInvalidTokens(
				result.invalidTokens,
			);
			this.logger.warn(
				`Deactivated invalid tokens: ${result.invalidTokens.length}`,
			);
		}

		this.logger.debug(
			`Push sent to user ${userId}: success=${result.successCount}, failure=${result.failureCount}`,
		);
	}

	/**
	 * 여러 사용자에게 푸시 발송
	 */
	private async sendPushToUsers(
		userIds: string[],
		payloads: Array<{ userId: string } & Omit<PushPayload, "token">>,
	): Promise<void> {
		// 모든 사용자의 활성 토큰 조회
		const tokens =
			await this.notificationRepository.findActivePushTokensByUsers(userIds);

		if (tokens.length === 0) {
			this.logger.debug("No active push tokens for users");
			return;
		}

		// userId -> tokens 매핑
		const tokensByUser = new Map<string, string[]>();
		for (const token of tokens) {
			const userTokens = tokensByUser.get(token.userId) ?? [];
			userTokens.push(token.token);
			tokensByUser.set(token.userId, userTokens);
		}

		// 페이로드에 토큰 매칭
		const pushPayloads: PushPayload[] = [];
		for (const payload of payloads) {
			const userTokens = tokensByUser.get(payload.userId) ?? [];
			for (const token of userTokens) {
				pushPayloads.push({
					token,
					title: payload.title,
					body: payload.body,
					data: payload.data,
				});
			}
		}

		if (pushPayloads.length === 0) {
			return;
		}

		const result = await this.pushProvider.sendBatch(pushPayloads);

		// 잘못된 토큰 비활성화
		if (result.invalidTokens.length > 0) {
			await this.notificationRepository.deactivateInvalidTokens(
				result.invalidTokens,
			);
			this.logger.warn(
				`Deactivated invalid tokens: ${result.invalidTokens.length}`,
			);
		}

		this.logger.debug(
			`Batch push sent: total=${result.total}, success=${result.successCount}, failure=${result.failureCount}`,
		);
	}

	// =========================================================================
	// 관리 기능
	// =========================================================================

	/**
	 * 오래된 알림 정리 (90일 이상)
	 * 스케줄러에서 호출
	 */
	async cleanupOldNotifications(
		daysOld: number = 90,
	): Promise<{ count: number }> {
		const result =
			await this.notificationRepository.deleteOldNotifications(daysOld);

		this.logger.log(`Old notifications cleaned up: count=${result.count}`);

		return result;
	}
}
