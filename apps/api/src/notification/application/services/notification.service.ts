import { Inject, Injectable, Logger } from "@nestjs/common";
import { subtractMilliseconds } from "@/shared/domain/date/utils/arithmetic";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { isUniqueConstraintViolation } from "@/shared/infrastructure/database/prisma-error.util";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import {
	type ILockProvider,
	LOCK_PROVIDER,
} from "@/shared/infrastructure/lock";
import type { NotificationRecord } from "../../domain/records/notification.record";
import {
	buildDedupContextFields,
	buildDedupKey,
	DEDUP_LOCK_TTL,
	resolveDedupStrategy,
} from "../../domain/services/notification-dedup";
import type { NotificationType } from "../../domain/types/notification-type";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../ports/notification.repository.port";
import type { CreateNotificationData } from "../ports/notification-data";
import { PushDeliveryService } from "./push-delivery.service";

@Injectable()
export class NotificationService {
	readonly #logger = new Logger(NotificationService.name);

	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		private readonly pushDeliveryService: PushDeliveryService,
		private readonly cacheService: CacheService,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
		@Inject(DEDUP_PROVIDER)
		private readonly dedupProvider: IDedupProvider,
	) {}

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
	): Promise<NotificationRecord | null> {
		const strategy = resolveDedupStrategy(data.type);

		if (!strategy) {
			return this.createAndSend(data);
		}

		const dedupKey = buildDedupKey(data, strategy);
		const release = await this.lockProvider.acquire(dedupKey, DEDUP_LOCK_TTL);

		if (!release) {
			this.#logger.debug(
				`Notification dedup: lock busy for ${data.type}, userId=${data.userId}`,
			);
			return null;
		}

		try {
			const since = subtractMilliseconds(strategy.windowMs);
			const contextFields = buildDedupContextFields(data, strategy);
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
	 * 알림 생성 및 푸시 발송
	 *
	 * 1. DB에 알림 레코드 생성 (P2002 unique violation 시 graceful skip → null 반환)
	 * 2. 사용자 푸시 설정 확인
	 * 3. 설정에 따라 푸시 발송 (fire-and-forget)
	 */
	async createAndSend(
		data: CreateNotificationData,
	): Promise<NotificationRecord | null> {
		let notification: NotificationRecord;
		try {
			notification = await this.notificationRepository.createNotification(data);
		} catch (error) {
			if (isUniqueConstraintViolation(error)) {
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
	async createOnly(data: CreateNotificationData): Promise<NotificationRecord> {
		return this.notificationRepository.createNotification(data);
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
