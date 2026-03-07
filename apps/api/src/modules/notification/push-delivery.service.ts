import {
	NOTIFICATION_ACTION_TYPE,
	type PushNotificationData,
} from "@aido/validators";
import {
	type BeforeApplicationShutdown,
	Inject,
	Injectable,
	Logger,
} from "@nestjs/common";
import { CacheService } from "@/common/cache/cache.service";
import { CacheKeys } from "@/common/cache/constants/cache-keys";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import {
	type NotificationType,
	Prisma,
	type PushToken,
} from "@/generated/prisma/client";
import { UserConsentRepository } from "@/modules/user-settings/repositories/user-consent.repository";
import { UserPreferenceRepository } from "@/modules/user-settings/repositories/user-preference.repository";

import { NotificationRepository } from "./notification.repository";
import {
	PUSH_PROVIDER,
	type PushPayload,
	type PushProvider,
} from "./providers/push-provider.interface";
import { type IPushRateLimiter, PUSH_RATE_LIMITER } from "./rate-limiter";
import type {
	CreateNotificationData,
	RegisterPushTokenData,
} from "./types/notification.types";
import { isNightTime } from "./utils";

// =============================================================================
// 마케팅 알림 타입
// =============================================================================

const MARKETING_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
	// 향후 추가 예정: "MARKETING_PROMOTION", "MARKETING_EVENT" 등
]);

/**
 * 야간 시간(21:00-08:00)에도 푸시를 발송하는 알림 타입
 *
 * 사용자가 직접 트리거한 액션의 결과 알림은 야간에도 발송한다:
 * - NUDGE_RECEIVED: 긴급성 있는 실시간 소셜 인터랙션
 */
const NIGHT_EXEMPT_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
	"NUDGE_RECEIVED",
]);

// =============================================================================
// PushDeliveryService
// =============================================================================

/**
 * 푸시 발송 서비스
 *
 * - 푸시 토큰 등록/해제
 * - 푸시 발송 및 필터링
 * - 푸시 페이로드 빌드
 * - Graceful Shutdown (pending push 대기)
 */
@Injectable()
export class PushDeliveryService implements BeforeApplicationShutdown {
	readonly #logger = new Logger(PushDeliveryService.name);
	readonly #pendingPushes = new Set<Promise<void>>();

	constructor(
		private readonly notificationRepository: NotificationRepository,
		@Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
		private readonly userPreferenceRepository: UserPreferenceRepository,
		private readonly userConsentRepository: UserConsentRepository,
		@Inject(PUSH_RATE_LIMITER)
		private readonly rateLimiter: IPushRateLimiter,
		private readonly cacheService: CacheService,
	) {}

	// =========================================================================
	// 푸시 토큰 관리
	// =========================================================================

	async registerPushToken(data: RegisterPushTokenData): Promise<PushToken> {
		if (!this.pushProvider.validateToken(data.token)) {
			throw BusinessExceptions.invalidPushToken(data.token);
		}

		const pushToken = await this.notificationRepository.registerPushToken(data);
		await this.cacheService.invalidatePushTokens(data.userId);

		if (data.timezone) {
			await this.userPreferenceRepository.upsertTimezone(
				data.userId,
				data.timezone,
			);
			await this.cacheService.invalidateUserPreference(data.userId);
		}

		this.#logger.log(
			`Push token registered: userId=${data.userId}, deviceId=${data.deviceId}`,
		);

		return pushToken;
	}

	async unregisterPushToken(userId: string, deviceId: string): Promise<void> {
		try {
			await this.notificationRepository.deletePushToken(userId, deviceId);
			await this.cacheService.invalidatePushTokens(userId);
			this.#logger.log(
				`Push token unregistered: userId=${userId}, deviceId=${deviceId}`,
			);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				this.#logger.warn(
					`Push token not found: userId=${userId}, deviceId=${deviceId}`,
				);
				return;
			}
			throw error;
		}
	}

	async unregisterAllPushTokens(userId: string): Promise<void> {
		const result =
			await this.notificationRepository.deleteAllPushTokensByUser(userId);
		await this.cacheService.invalidatePushTokens(userId);
		this.#logger.log(
			`All push tokens unregistered: userId=${userId}, count=${result.count}`,
		);
	}

	// =========================================================================
	// 푸시 발송 (단건)
	// =========================================================================

	/**
	 * 단일 사용자에게 푸시 발송 (fire-and-forget)
	 *
	 * 1. 사용자 푸시 설정 확인
	 * 2. 설정 통과 시 활성 토큰으로 푸시 발송
	 * 3. 실패한 토큰 비활성화
	 */
	fireAndForgetPush(
		data: CreateNotificationData,
		notificationId: number,
	): void {
		const pushData = this.#buildPushPayloadData(data, notificationId);

		const pushPromise = this.#sendPushToUser(data.userId, {
			title: data.title,
			body: data.body,
			data: pushData,
		}).catch((error) => {
			this.#logger.error(
				`Failed to send push notification: userId=${data.userId}, error=${error}`,
			);
		}) as Promise<void>;
		this.#trackPush(pushPromise);
	}

	// =========================================================================
	// 푸시 발송 (배치)
	// =========================================================================

	/**
	 * 여러 사용자에게 푸시 발송 (fire-and-forget)
	 *
	 * N+1 쿼리 최적화: 사용자별 설정을 배치로 한 번에 조회
	 */
	fireAndForgetBatchPush(dataList: CreateNotificationData[]): void {
		const pushPromise = this.#sendBatchPush(dataList).catch((error) => {
			this.#logger.error(
				`Failed to send batch push notifications: error=${error}`,
			);
		}) as Promise<void>;
		this.#trackPush(pushPromise);
	}

	async #sendBatchPush(dataList: CreateNotificationData[]): Promise<void> {
		const userIds = [...new Set(dataList.map((d) => d.userId))];

		const [preferences, consents] = await Promise.all([
			this.userPreferenceRepository.findByUserIds(userIds),
			this.userConsentRepository.findByUserIds(userIds),
		]);

		const prefMap = new Map(preferences.map((p) => [p.userId, p]));
		const consentMap = new Map(consents.map((c) => [c.userId, c]));

		const eligibleDataList: CreateNotificationData[] = [];
		for (const data of dataList) {
			const shouldSend = this.#canSendPushWithCachedData(
				data.type as NotificationType,
				prefMap.get(data.userId),
				consentMap.get(data.userId),
			);
			if (shouldSend) {
				eligibleDataList.push(data);
			} else {
				this.#logger.debug(
					`Push notification skipped due to user settings: userId=${data.userId}, type=${data.type}`,
				);
			}
		}

		if (eligibleDataList.length === 0) {
			return;
		}

		const eligibleUserIds = [...new Set(eligibleDataList.map((d) => d.userId))];

		await this.#sendPushToUsers(
			eligibleUserIds,
			eligibleDataList.map((d) => ({
				userId: d.userId,
				title: d.title,
				body: d.body,
				data: this.#buildPushPayloadData(d),
			})),
		);
	}

	// =========================================================================
	// 푸시 필터링
	// =========================================================================

	/**
	 * 푸시 발송 여부 결정
	 */
	async shouldSendPush(
		userId: string,
		type: NotificationType,
	): Promise<boolean> {
		const preference = await this.userPreferenceRepository.findByUserId(userId);

		if (!preference) {
			this.#logger.debug(
				`No preference found for user ${userId}, skipping push`,
			);
			return false;
		}

		if (!preference.pushEnabled) {
			return false;
		}

		if (
			isNightTime(preference.timezone ?? "UTC") &&
			!preference.nightPushEnabled &&
			!NIGHT_EXEMPT_NOTIFICATION_TYPES.has(type)
		) {
			return false;
		}

		if (this.#isMarketingNotification(type)) {
			const consent = await this.userConsentRepository.findByUserId(userId);
			if (!consent?.marketingAgreedAt) {
				return false;
			}
		}

		if (await this.rateLimiter.isRateLimited(userId)) {
			this.#logger.debug(`Push rate limited: userId=${userId}, type=${type}`);
			return false;
		}

		return true;
	}

	#isMarketingNotification(type: NotificationType): boolean {
		return MARKETING_NOTIFICATION_TYPES.has(type);
	}

	#canSendPushWithCachedData(
		type: NotificationType,
		preference:
			| {
					pushEnabled: boolean;
					nightPushEnabled: boolean;
					timezone?: string;
			  }
			| undefined,
		consent: { marketingAgreedAt: Date | null } | undefined,
	): boolean {
		if (!preference) {
			return false;
		}

		if (!preference.pushEnabled) {
			return false;
		}

		if (
			isNightTime(preference.timezone ?? "UTC") &&
			!preference.nightPushEnabled &&
			!NIGHT_EXEMPT_NOTIFICATION_TYPES.has(type)
		) {
			return false;
		}

		if (this.#isMarketingNotification(type)) {
			if (!consent?.marketingAgreedAt) {
				return false;
			}
		}

		return true;
	}

	// =========================================================================
	// 푸시 페이로드 빌드
	// =========================================================================

	#buildPushPayloadData(
		data: CreateNotificationData,
		notificationId?: number,
	): PushNotificationData {
		const action = data.action ?? {
			type: NOTIFICATION_ACTION_TYPE.DEEP_LINK,
			url: undefined,
		};

		const context: PushNotificationData["context"] = {};
		if (data.todoId) context.todoId = data.todoId;
		if (data.friendId) context.friendId = data.friendId;
		if (data.nudgeId) context.nudgeId = data.nudgeId;
		if (data.cheerId) context.cheerId = data.cheerId;

		return {
			notificationId: notificationId ?? 0,
			type: data.type,
			action: {
				type: action.type,
				...(action.url && { url: action.url }),
			},
			...(Object.keys(context).length > 0 && { context }),
		};
	}

	// =========================================================================
	// 푸시 발송 (Internal)
	// =========================================================================

	async #sendPushToUser(
		userId: string,
		payload: Omit<PushPayload, "token">,
	): Promise<void> {
		const tokenStrings = await this.cacheService.wrapPushTokens(
			userId,
			async () => {
				const tokens = await this.notificationRepository.findPushTokensByUser({
					userId,
					activeOnly: true,
				});
				return tokens.map((t) => t.token);
			},
		);

		if (tokenStrings.length === 0) {
			this.#logger.debug(`No active push tokens for user: ${userId}`);
			return;
		}

		const payloads: PushPayload[] = tokenStrings.map((token) => ({
			...payload,
			token,
		}));

		const result = await this.pushProvider.sendBatch(payloads);

		if (result.invalidTokens.length > 0) {
			await this.notificationRepository.deactivateInvalidTokens(
				result.invalidTokens,
			);
			await this.cacheService.invalidatePushTokens(userId);
			this.#logger.warn(
				`Deactivated invalid tokens: ${result.invalidTokens.length}`,
			);
		}

		this.#logger.debug(
			`Push sent to user ${userId}: success=${result.successCount}, failure=${result.failureCount}`,
		);
	}

	async #sendPushToUsers(
		userIds: string[],
		payloads: Array<{ userId: string } & Omit<PushPayload, "token">>,
	): Promise<void> {
		const tokensByUser = await this.#resolveTokensByUsers(userIds);

		if (tokensByUser.size === 0) {
			this.#logger.debug("No active push tokens for users");
			return;
		}

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

		if (result.invalidTokens.length > 0) {
			await this.notificationRepository.deactivateInvalidTokens(
				result.invalidTokens,
			);
			await Promise.all(
				userIds.map((uid) => this.cacheService.invalidatePushTokens(uid)),
			);
			this.#logger.warn(
				`Deactivated invalid tokens: ${result.invalidTokens.length}`,
			);
		}

		this.#logger.debug(
			`Batch push sent: total=${result.total}, success=${result.successCount}, failure=${result.failureCount}`,
		);
	}

	/**
	 * scatter-gather 패턴으로 다수 사용자의 푸시 토큰 조회
	 *
	 * 1) mget: 1회 Redis 호출로 모든 사용자 토큰 조회
	 * 2) 캐시 미스분만 배치 DB 쿼리 1회
	 * 3) mset: 1회 Redis 호출로 캐시 적재 (negative cache 포함)
	 */
	async #resolveTokensByUsers(
		userIds: string[],
	): Promise<Map<string, string[]>> {
		const tokensByUser = new Map<string, string[]>();

		const cacheKeys = userIds.map((uid) => CacheKeys.pushTokens(uid));
		const cached = await this.cacheService.mget<string[]>(cacheKeys);

		const missedUserIds: string[] = [];
		for (const [i, uid] of userIds.entries()) {
			const entry = cached[i];
			if (entry !== undefined) {
				if (entry.length > 0) {
					tokensByUser.set(uid, entry);
				}
			} else {
				missedUserIds.push(uid);
			}
		}

		if (missedUserIds.length > 0) {
			const dbTokens =
				await this.notificationRepository.findActivePushTokensByUsers(
					missedUserIds,
				);

			const dbTokensByUser = new Map<string, string[]>();
			for (const t of dbTokens) {
				const arr = dbTokensByUser.get(t.userId) ?? [];
				arr.push(t.token);
				dbTokensByUser.set(t.userId, arr);
			}

			await this.cacheService.mset(
				missedUserIds.map((uid) => ({
					key: CacheKeys.pushTokens(uid),
					value: dbTokensByUser.get(uid) ?? [],
					ttl: CacheKeys.TTL.PUSH_TOKENS,
				})),
			);

			for (const [uid, tokens] of dbTokensByUser) {
				tokensByUser.set(uid, tokens);
			}
		}

		return tokensByUser;
	}

	// =========================================================================
	// Graceful Shutdown
	// =========================================================================

	#trackPush(promise: Promise<void>): void {
		this.#pendingPushes.add(promise);
		promise.finally(() => this.#pendingPushes.delete(promise));
	}

	async beforeApplicationShutdown(): Promise<void> {
		if (this.#pendingPushes.size > 0) {
			this.#logger.log(
				`Waiting for ${this.#pendingPushes.size} pending push(es)...`,
			);
			await Promise.allSettled([...this.#pendingPushes]);
			this.#logger.log("All pending pushes completed");
		}
	}
}
