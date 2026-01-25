import type { Notification as NotificationDto } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginatedResponse } from "@/common/pagination/interfaces/pagination.interface";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import type {
	Notification,
	NotificationType,
	PushToken,
} from "@/generated/prisma/client";
import { UserConsentRepository } from "@/modules/auth/repositories/user-consent.repository";
import { UserPreferenceRepository } from "@/modules/auth/repositories/user-preference.repository";

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
import { isNightTime } from "./utils";

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
/**
 * 마케팅 알림 타입 목록
 * 향후 마케팅 알림이 추가되면 여기에 등록합니다.
 * 마케팅 알림은 marketingAgreedAt이 있어야만 발송됩니다.
 */
const MARKETING_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
	// 현재는 마케팅 알림 타입이 없음
	// 향후 추가 예정: "MARKETING_PROMOTION", "MARKETING_EVENT" 등
]);

@Injectable()
export class NotificationService {
	private readonly logger = new Logger(NotificationService.name);

	constructor(
		private readonly notificationRepository: NotificationRepository,
		private readonly paginationService: PaginationService,
		@Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
		private readonly userPreferenceRepository: UserPreferenceRepository,
		private readonly userConsentRepository: UserConsentRepository,
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
	 * 2. 사용자 푸시 설정 확인 (pushEnabled, nightPushEnabled, 마케팅 동의)
	 * 3. 설정에 따라 푸시 발송 여부 결정
	 * 4. 발송 시 실패한 토큰 비활성화
	 */
	async createAndSend(data: CreateNotificationData): Promise<Notification> {
		// 1. DB에 알림 생성 (항상 저장)
		const notification =
			await this.notificationRepository.createNotification(data);

		// 2. 푸시 발송 여부 결정
		const shouldSend = await this.shouldSendPush(
			data.userId,
			data.type as NotificationType,
		);

		if (!shouldSend) {
			this.logger.debug(
				`Push notification skipped due to user settings: userId=${data.userId}, type=${data.type}`,
			);
			return notification;
		}

		// 3. 푸시 발송 (비동기, 에러 발생해도 알림 생성은 성공)
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

		// 1. DB에 알림 일괄 생성 (항상 저장)
		const result =
			await this.notificationRepository.createManyNotifications(dataList);

		// 2. 각 사용자별 푸시 발송 가능 여부 확인
		const eligibleDataList: CreateNotificationData[] = [];
		for (const data of dataList) {
			const shouldSend = await this.shouldSendPush(
				data.userId,
				data.type as NotificationType,
			);
			if (shouldSend) {
				eligibleDataList.push(data);
			} else {
				this.logger.debug(
					`Push notification skipped due to user settings: userId=${data.userId}, type=${data.type}`,
				);
			}
		}

		if (eligibleDataList.length === 0) {
			return result;
		}

		// 3. 고유 사용자 ID 추출 (발송 대상만)
		const userIds = [...new Set(eligibleDataList.map((d) => d.userId))];

		// 4. 푸시 발송 (비동기, 에러 발생해도 알림 생성은 성공)
		this.sendPushToUsers(
			userIds,
			eligibleDataList.map((d) => ({
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
	// 푸시 필터링 (Private)
	// =========================================================================

	/**
	 * 푸시 발송 여부 결정
	 *
	 * 다음 조건을 순차적으로 확인합니다:
	 * 1. pushEnabled가 false면 발송 안 함
	 * 2. 야간 시간(21:00-08:00 KST)이고 nightPushEnabled가 false면 발송 안 함
	 * 3. 마케팅 알림인데 marketingAgreedAt이 null이면 발송 안 함
	 *
	 * @param userId 사용자 ID
	 * @param type 알림 타입
	 * @returns 푸시 발송 여부
	 */
	private async shouldSendPush(
		userId: string,
		type: NotificationType,
	): Promise<boolean> {
		// 1. 사용자 푸시 설정 조회
		const preference = await this.userPreferenceRepository.findByUserId(userId);

		// 설정이 없으면 기본값(pushEnabled=false)으로 발송 안 함
		if (!preference) {
			this.logger.debug(
				`No preference found for user ${userId}, skipping push`,
			);
			return false;
		}

		// 2. 푸시 전체 OFF 확인
		if (!preference.pushEnabled) {
			return false;
		}

		// 3. 야간 시간대 확인 (21:00-08:00 KST)
		if (isNightTime() && !preference.nightPushEnabled) {
			return false;
		}

		// 4. 마케팅 알림 확인
		if (this.isMarketingNotification(type)) {
			const consent = await this.userConsentRepository.findByUserId(userId);
			if (!consent?.marketingAgreedAt) {
				return false;
			}
		}

		return true;
	}

	/**
	 * 마케팅 알림 여부 확인
	 */
	private isMarketingNotification(type: NotificationType): boolean {
		return MARKETING_NOTIFICATION_TYPES.has(type);
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
