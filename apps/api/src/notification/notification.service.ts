import {
	CATEGORY_TYPE_MAP,
	type NotificationCategory,
	type Notification as NotificationDto,
} from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	type Notification,
	type NotificationType,
	Prisma,
} from "@/generated/prisma/client";
import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";
import { TIME_UNIT } from "@/shared/domain/date/constants/date.constant";
import { subtractMilliseconds } from "@/shared/domain/date/utils/arithmetic";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import {
	type ILockProvider,
	LOCK_PROVIDER,
} from "@/shared/infrastructure/lock";

import { NotificationMapper } from "./notification.mapper";
import { NotificationRepository } from "./notification.repository";
import { PushDeliveryService } from "./push-delivery.service";
import type {
	CreateNotificationData,
	FindNotificationsParams,
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
		@Inject(DEDUP_PROVIDER)
		private readonly dedupProvider: IDedupProvider,
	) {}

	/**
	 * 알림 타입별 서비스 레이어 중복 방지 전략
	 *
	 * - DB partial unique index로 보호되는 타입 (DAILY_COMPLETE 등): 맵에 없음 → createAndSend 직접 사용
	 * - 중복 허용 타입 (SYSTEM_NOTICE, ADMIN_*): 맵에 없음 → createAndSend 직접 사용
	 * - NUDGE_RECEIVED: NudgeService에서 쿨다운(24h/Todo) + 일일 제한으로 이미 보호 → 맵에 없음
	 * - CHEER_RECEIVED: CheerService에서 쿨다운(24h/receiver) + 일일 제한으로 이미 보호 → 맵에 없음
	 * - 서비스 dedup 필요 타입: windowMs + 체크 키 정의
	 */
	private static readonly DEDUP_WINDOW = {
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
	): Promise<Notification | null> {
		const strategy = NotificationService.DEDUP_STRATEGIES[data.type];

		if (!strategy) {
			return this.createAndSend(data);
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

			const exists =
				await this.notificationRepository.existsRecentNotification(params);
			if (exists) {
				this.#logger.debug(
					`Notification dedup: skipped ${data.type} for userId=${data.userId}`,
				);
				return null;
			}

			return await this.createAndSend(data);
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
	): Promise<Notification | null> {
		let notification: Notification;
		try {
			notification = await this.notificationRepository.createNotification(data);
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
	 *
	 * DB 성공 후 Redis에 기록 (순서 보장):
	 * DB 실패 시 addMembers에 도달하지 않으므로 불일치 방지
	 */
	async createAndSendBatch(
		dataList: CreateNotificationData[],
	): Promise<{ count: number }> {
		if (dataList.length === 0) {
			return { count: 0 };
		}

		// 1. DB 먼저 (최종 방어선 — unique index)
		const result =
			await this.notificationRepository.createManyNotifications(dataList);

		// 2. 푸시 발송 + unread count 무효화
		this.pushDeliveryService.fireAndForgetBatchPush(dataList);

		const uniqueUserIds = [...new Set(dataList.map((d) => d.userId))];
		void Promise.all(
			uniqueUserIds.map((uid) => this.cacheService.invalidateUnreadCount(uid)),
		);

		// 3. DB 성공 확인 후 Redis에 기록 (fire-and-forget)
		const groups = new Map<string, string[]>();
		for (const d of dataList) {
			if (!d.notificationDate) continue;
			const key = DedupKeys.notified(d.type, d.notificationDate);
			const arr = groups.get(key) ?? [];
			arr.push(d.userId);
			groups.set(key, arr);
		}
		void Promise.all(
			[...groups.entries()].map(([key, userIds]) =>
				this.dedupProvider.addMembers(
					key,
					[DedupKeys.SENTINEL, ...userIds],
					DedupKeys.TTL.NOTIFIED,
				),
			),
		);

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
	 * 이미 알림을 받은 사용자 ID 목록 조회 (배치)
	 *
	 * Sentinel 기반 atomic cold-start 감지:
	 * - 단일 SMISMEMBER 호출로 sentinel + userIds를 동시에 확인
	 * - Sentinel 있음 = warm → Redis 결과 신뢰
	 * - Sentinel 없음 = cold start → DB fallback + warm-up
	 */
	async findAlreadyNotifiedUserIds(params: {
		userIds: string[];
		type: NotificationType;
		notificationDate: Date;
		friendId?: string;
	}): Promise<Set<string>> {
		const setKey = DedupKeys.notified(params.type, params.notificationDate);

		// 단일 SMISMEMBER: sentinel + userIds → atomic cold-start 감지
		const result = await this.dedupProvider.filterMembers(setKey, [
			DedupKeys.SENTINEL,
			...params.userIds,
		]);

		if (result.has(DedupKeys.SENTINEL)) {
			// Set이 warm 상태 → Redis 결과 신뢰
			result.delete(DedupKeys.SENTINEL);
			return result;
		}

		// Cold start: DB fallback + Redis warm-up
		const fromDb =
			await this.notificationRepository.findAlreadyNotifiedUserIds(params);

		void this.dedupProvider.addMembers(
			setKey,
			[DedupKeys.SENTINEL, ...[...fromDb]],
			DedupKeys.TTL.NOTIFIED,
		);

		return fromDb;
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
