import {
	CATEGORY_TYPE_MAP,
	type NotificationCategory,
	type Notification as NotificationDto,
} from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { CacheService } from "@/common/cache/cache.service";
import { TIME_UNIT } from "@/common/date/constants/date.constant";
import { subtractMilliseconds } from "@/common/date/utils/arithmetic";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import type { CursorPaginatedResponse } from "@/common/pagination/interfaces/pagination.interface";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import {
	type Notification,
	type NotificationType,
	Prisma,
} from "@/generated/prisma/client";

import { NotificationMapper } from "./notification.mapper";
import { NotificationRepository } from "./notification.repository";
import { PushDeliveryService } from "./push-delivery.service";
import type {
	CreateNotificationData,
	FindNotificationsParams,
	TransactionClient,
} from "./types/notification.types";

@Injectable()
export class NotificationService {
	readonly #logger = new Logger(NotificationService.name);

	constructor(
		private readonly notificationRepository: NotificationRepository,
		private readonly paginationService: PaginationService,
		private readonly pushDeliveryService: PushDeliveryService,
		private readonly cacheService: CacheService,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * 알림 타입별 서비스 레이어 중복 방지 전략
	 *
	 * - DB partial unique index로 보호되는 타입 (DAILY_COMPLETE 등): 맵에 없음 → createAndSend 직접 사용
	 * - 중복 허용 타입 (SYSTEM_NOTICE, ADMIN_*): 맵에 없음 → createAndSend 직접 사용
	 * - 서비스 dedup 필요 타입: windowMs + 체크 키 정의
	 */
	private static readonly DEDUP_WINDOW = {
		NUDGE: TIME_UNIT.MS_PER_HOUR, // 1시간
		CHEER: 5 * TIME_UNIT.MS_PER_MINUTE, // 5분
		FOLLOW: 24 * TIME_UNIT.MS_PER_HOUR, // 24시간
	} as const;

	private static readonly DEDUP_STRATEGIES: Partial<
		Record<
			NotificationType,
			{
				windowMs: number;
				keys: Array<"friendId" | "todoId" | "nudgeId" | "cheerId">;
			}
		>
	> = {
		NUDGE_RECEIVED: {
			windowMs: NotificationService.DEDUP_WINDOW.NUDGE,
			keys: ["friendId"],
		},
		CHEER_RECEIVED: {
			windowMs: NotificationService.DEDUP_WINDOW.CHEER,
			keys: ["friendId"],
		},
		FOLLOW_NEW: {
			windowMs: NotificationService.DEDUP_WINDOW.FOLLOW,
			keys: ["friendId"],
		},
		FOLLOW_ACCEPTED: {
			windowMs: NotificationService.DEDUP_WINDOW.FOLLOW,
			keys: ["friendId"],
		},
	};

	/** dedup 잠금 TTL (밀리초) — DB 조회 + 생성에 충분한 시간 */
	private static readonly DEDUP_LOCK_TTL = 5_000;

	/**
	 * 중복 방지가 적용된 알림 생성 및 푸시 발송
	 *
	 * Race Condition 방지: ILockProvider 기반 잠금으로
	 * 같은 (userId, type, contextKeys) 조합의 동시 요청을 직렬화합니다.
	 *
	 * @returns 생성된 Notification 또는 null (중복 스킵 / 잠금 대기 스킵)
	 */
	async createAndSendWithDedup(
		data: CreateNotificationData,
		tx?: TransactionClient,
	): Promise<Notification | null> {
		const strategy = NotificationService.DEDUP_STRATEGIES[data.type];

		if (!strategy) {
			return this.createAndSend(data, tx);
		}

		const dedupKey = this.#buildDedupKey(data, strategy);
		const release = await this.lockProvider.acquire(
			dedupKey,
			NotificationService.DEDUP_LOCK_TTL,
		);

		if (!release) {
			this.#logger.debug(
				`Notification dedup: lock busy for ${data.type}, userId=${data.userId}`,
			);
			return null;
		}

		try {
			const since = subtractMilliseconds(strategy.windowMs);
			const contextFields: {
				friendId?: string;
				todoId?: number;
				nudgeId?: number;
				cheerId?: number;
			} = {};
			for (const key of strategy.keys) {
				const value = data[key];
				if (value != null) {
					(contextFields as Record<string, string | number>)[key] = value;
				}
			}
			const params = {
				userId: data.userId,
				type: data.type,
				since,
				...contextFields,
			};

			const exists = await this.notificationRepository.existsRecentNotification(
				params,
				tx,
			);
			if (exists) {
				this.#logger.debug(
					`Notification dedup: skipped ${data.type} for userId=${data.userId}`,
				);
				return null;
			}

			return await this.createAndSend(data, tx);
		} finally {
			await release();
		}
	}

	/**
	 * 중복 방지 잠금 키 생성
	 */
	#buildDedupKey(
		data: CreateNotificationData,
		strategy: {
			keys: Array<"friendId" | "todoId" | "nudgeId" | "cheerId">;
		},
	): string {
		const parts = ["dedup", data.userId, data.type];
		for (const key of strategy.keys) {
			const value = data[key];
			if (value != null) {
				parts.push(`${key}:${String(value)}`);
			}
		}
		return parts.join(":");
	}

	/**
	 * 알림 생성 및 푸시 발송
	 *
	 * 1. DB에 알림 레코드 생성 (P2002 unique violation 시 graceful skip → null 반환)
	 * 2. 사용자 푸시 설정 확인
	 * 3. 설정에 따라 푸시 발송 (fire-and-forget)
	 */
	async createAndSend(
		data: CreateNotificationData,
		tx?: TransactionClient,
	): Promise<Notification | null> {
		let notification: Notification;
		try {
			notification = await this.notificationRepository.createNotification(
				data,
				tx,
			);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				this.#logger.debug(
					`Notification dedup: unique constraint prevented duplicate ${data.type} for userId=${data.userId}`,
				);
				return null;
			}
			throw error;
		}

		const shouldSend = await this.pushDeliveryService.shouldSendPush(
			data.userId,
			data.type,
		);

		if (!shouldSend) {
			this.#logger.debug(
				`Push notification skipped due to user settings: userId=${data.userId}, type=${data.type}`,
			);
			return notification;
		}

		this.pushDeliveryService.fireAndForgetPush(data, notification.id);
		void this.cacheService.invalidateUnreadCount(data.userId);

		return notification;
	}

	/**
	 * 여러 사용자에게 알림 생성 및 발송
	 */
	async createAndSendBatch(
		dataList: CreateNotificationData[],
		tx?: TransactionClient,
	): Promise<{ count: number }> {
		if (dataList.length === 0) {
			return { count: 0 };
		}

		const result = await this.notificationRepository.createManyNotifications(
			dataList,
			tx,
		);

		this.pushDeliveryService.fireAndForgetBatchPush(dataList);

		const uniqueUserIds = [...new Set(dataList.map((d) => d.userId))];
		for (const uid of uniqueUserIds) {
			void this.cacheService.invalidateUnreadCount(uid);
		}

		return result;
	}

	/**
	 * 알림만 생성 (푸시 발송 없이)
	 */
	async createOnly(data: CreateNotificationData): Promise<Notification> {
		return this.notificationRepository.createNotification(data);
	}

	/**
	 * 알림 목록 조회 (커서 기반 페이지네이션)
	 */
	async getNotifications(params: {
		userId: string;
		cursor?: number;
		size?: number;
		unreadOnly?: boolean;
		category?: NotificationCategory;
	}): Promise<CursorPaginatedResponse<NotificationDto, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const types =
			params.category && params.category !== "ALL"
				? [...CATEGORY_TYPE_MAP[params.category]]
				: undefined;

		const repoParams: FindNotificationsParams = {
			userId: params.userId,
			cursor,
			size,
			unreadOnly: params.unreadOnly,
			types,
		};

		const notifications =
			await this.notificationRepository.findNotificationsByUser(repoParams);

		this.#logger.debug(
			`Notifications listed: ${notifications.length} items for user: ${params.userId}`,
		);

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
	 * 읽지 않은 알림 수 조회 (2분 캐시)
	 */
	async getUnreadCount(userId: string): Promise<number> {
		return this.cacheService.wrapUnreadCount(userId, () =>
			this.notificationRepository.countUnread(userId),
		);
	}

	/**
	 * 단일 알림 읽음 처리
	 */
	async markAsRead(userId: string, notificationId: number): Promise<void> {
		const notification =
			await this.notificationRepository.findNotificationById(notificationId);

		if (!notification) {
			throw BusinessExceptions.notificationNotFound(notificationId);
		}

		if (notification.userId !== userId) {
			throw BusinessExceptions.notificationAccessDenied(notificationId);
		}

		if (notification.isRead) {
			return;
		}

		await this.notificationRepository.markAsRead(notificationId);
		await this.cacheService.invalidateUnreadCount(userId);

		this.#logger.debug(`Notification marked as read: id=${notificationId}`);
	}

	/**
	 * 모든 알림 읽음 처리
	 */
	async markAllAsRead(userId: string): Promise<{ count: number }> {
		const result = await this.notificationRepository.markAllAsRead(userId);
		await this.cacheService.invalidateUnreadCount(userId);

		this.#logger.debug(
			`All notifications marked as read: userId=${userId}, count=${result.count}`,
		);

		return result;
	}

	/**
	 * 특정 타입 + notificationDate 조합의 알림 존재 여부 확인
	 */
	async existsNotification(
		params: {
			userId: string;
			type: NotificationType;
			notificationDate: Date;
		},
		tx?: TransactionClient,
	): Promise<boolean> {
		return this.notificationRepository.existsNotification(params, tx);
	}

	/**
	 * metadata JSON 경로 기반 알림 존재 여부 확인
	 * - WINBACK 단계별 중복 방지용
	 */
	async hasNotificationWithMetadata(
		userId: string,
		type: NotificationType,
		metadataPath: string[],
		metadataValue: string,
		tx?: TransactionClient,
	): Promise<boolean> {
		return this.notificationRepository.existsNotificationWithMetadata(
			{ userId, type, metadataPath, metadataValue },
			tx,
		);
	}

	/**
	 * 이미 알림을 받은 사용자 ID 목록 조회 (배치)
	 */
	async findAlreadyNotifiedUserIds(
		params: {
			userIds: string[];
			type: NotificationType;
			notificationDate: Date;
			friendId?: string;
		},
		tx?: TransactionClient,
	): Promise<Set<string>> {
		return this.notificationRepository.findAlreadyNotifiedUserIds(params, tx);
	}

	/**
	 * 오래된 알림 정리 (90일 이상)
	 * 스케줄러에서 호출
	 */
	async cleanupOldNotifications(
		daysOld: number = 90,
	): Promise<{ count: number }> {
		const result =
			await this.notificationRepository.deleteOldNotifications(daysOld);

		this.#logger.log(`Old notifications cleaned up: count=${result.count}`);

		return result;
	}
}
