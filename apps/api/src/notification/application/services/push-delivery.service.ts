import { ErrorCode } from "@aido/errors";
import {
	NOTIFICATION_ACTION_TYPE,
	type PushNotificationData,
	USER_PREFERENCE_DEFAULTS,
} from "@aido/validators";
import {
	type BeforeApplicationShutdown,
	Inject,
	Injectable,
	Logger,
} from "@nestjs/common";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	type CachedUserPreference,
	CacheService,
} from "@/shared/infrastructure/cache/cache.service";
import { CacheKeys } from "@/shared/infrastructure/cache/constants/cache-keys";
import { isRecordNotFoundError } from "@/shared/infrastructure/database/prisma-error.util";
import {
	DEFAULT_LOCALE,
	type SupportedLocale,
	toSupportedLocale,
} from "@/shared/presentation/decorators";
import type { PushTokenRecord } from "../../domain/records/notification.record";
import { isNightTime } from "../../domain/services/night-time";
import {
	isMarketingNotification,
	isNightExemptNotification,
} from "../../domain/services/push-eligibility";
import type { NotificationType } from "../../domain/types/notification-type";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../ports/notification.repository.port";
import type {
	CreateNotificationData,
	RegisterPushTokenData,
} from "../ports/notification-data";
import {
	PUSH_PROVIDER,
	type PushPayload,
	type PushProvider,
} from "../ports/push-provider.port";
import {
	type IPushRateLimiter,
	PUSH_RATE_LIMITER,
} from "../ports/push-rate-limiter.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../ports/user-notification-settings.port";

@Injectable()
export class PushDeliveryService implements BeforeApplicationShutdown {
	readonly #logger = new Logger(PushDeliveryService.name);
	readonly #pendingPushes = new Set<Promise<void>>();

	constructor(
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
		@Inject(USER_NOTIFICATION_SETTINGS)
		private readonly userSettings: UserNotificationSettingsPort,
		@Inject(PUSH_RATE_LIMITER)
		private readonly rateLimiter: IPushRateLimiter,
		private readonly cacheService: CacheService,
	) {}

	async registerPushToken(
		data: RegisterPushTokenData,
	): Promise<PushTokenRecord> {
		if (!this.pushProvider.validateToken(data.token)) {
			throw new ApplicationException(ErrorCode.NOTIFICATION_1001, {
				token: data.token,
			});
		}

		const pushToken = await this.notificationRepository.registerPushToken(data);
		await this.cacheService.invalidatePushTokens(data.userId);

		if (data.timezone) {
			await this.userSettings.upsertPushTimezone(data.userId, data.timezone);
		}

		if (data.locale) {
			await this.userSettings.upsertPushLocale(data.userId, data.locale);
		}

		if (data.timezone || data.locale) {
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
			if (isRecordNotFoundError(error)) {
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
		});
		this.#trackPush(pushPromise);
	}

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
		});
		this.#trackPush(pushPromise);
	}

	async #sendBatchPush(dataList: CreateNotificationData[]): Promise<void> {
		const userIds = [...new Set(dataList.map((d) => d.userId))];

		const [preferences, consents] = await Promise.all([
			this.userSettings.getPreferenceRecordsByUserIds(userIds),
			this.userSettings.getConsentRecordsByUserIds(userIds),
		]);

		const prefMap = new Map(preferences.map((p) => [p.userId, p]));
		const consentMap = new Map(consents.map((c) => [c.userId, c]));

		const eligibleDataList: CreateNotificationData[] = [];
		for (const data of dataList) {
			const shouldSend = this.#canSendPushWithCachedData(
				data.type,
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

	/**
	 * UserPreference를 캐시 경유로 로드 (cache-aside — 미스 시 DB 조회 후 적재)
	 */
	async #loadPreference(userId: string): Promise<CachedUserPreference> {
		return this.cacheService.wrapUserPreference(userId, async () => {
			const raw = await this.userSettings.getPreferenceRecord(userId);
			if (!raw) {
				return {
					pushEnabled: USER_PREFERENCE_DEFAULTS.PUSH_ENABLED,
					nightPushEnabled: USER_PREFERENCE_DEFAULTS.NIGHT_PUSH_ENABLED,
					timezone: USER_PREFERENCE_DEFAULTS.TIMEZONE,
					locale: DEFAULT_LOCALE,
					morningReminderHour: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
					morningReminderMinute:
						USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE,
					eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
					eveningReminderMinute:
						USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE,
					timeFormat: USER_PREFERENCE_DEFAULTS.TIME_FORMAT,
					weatherMorningEnabled:
						USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_ENABLED,
					weatherMorningHour: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_HOUR,
					weatherMorningMinute: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_MINUTE,
					weatherEveningEnabled:
						USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_ENABLED,
					weatherEveningHour: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_HOUR,
					weatherEveningMinute: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_MINUTE,
				};
			}
			return {
				pushEnabled: raw.pushEnabled,
				nightPushEnabled: raw.nightPushEnabled,
				timezone: raw.timezone,
				locale: raw.locale,
				morningReminderHour: raw.morningReminderHour,
				morningReminderMinute: raw.morningReminderMinute,
				eveningReminderHour: raw.eveningReminderHour,
				eveningReminderMinute: raw.eveningReminderMinute,
				timeFormat: raw.timeFormat,
				weatherMorningEnabled: raw.weatherMorningEnabled,
				weatherMorningHour: raw.weatherMorningHour,
				weatherMorningMinute: raw.weatherMorningMinute,
				weatherEveningEnabled: raw.weatherEveningEnabled,
				weatherEveningHour: raw.weatherEveningHour,
				weatherEveningMinute: raw.weatherEveningMinute,
			};
		});
	}

	/**
	 * 수신자 푸시 언어 조회 — shouldSendPush와 같은 캐시 키를 공유하므로
	 * 한 발송 사이클에서 preference는 사실상 1회만 읽힌다.
	 * 구버전 캐시 엔트리(locale 없음)는 ko로 내로잉.
	 */
	async getUserLocale(userId: string): Promise<SupportedLocale> {
		const preference = await this.#loadPreference(userId);
		return toSupportedLocale(preference.locale);
	}

	/**
	 * 푸시 발송 여부 결정
	 */
	async shouldSendPush(
		userId: string,
		type: NotificationType,
	): Promise<boolean> {
		const preference = await this.#loadPreference(userId);

		if (!preference.pushEnabled) {
			return false;
		}

		// Rate limit은 Redis O(1) — 캐시/DB 조회보다 먼저 체크하여 불필요한 연산 방지
		if (await this.rateLimiter.isRateLimited(userId)) {
			this.#logger.debug(`Push rate limited: userId=${userId}, type=${type}`);
			return false;
		}

		if (
			isNightTime(preference.timezone) &&
			!preference.nightPushEnabled &&
			!isNightExemptNotification(type)
		) {
			return false;
		}

		if (isMarketingNotification(type)) {
			const consent = await this.userSettings.getConsentRecord(userId);
			if (!consent?.marketingAgreedAt) {
				return false;
			}
		}

		return true;
	}

	/**
	 * 배치 경로용 푸시 발송 판단 (설정 + 마케팅 동의만 확인)
	 *
	 * Rate limit은 의도적으로 생략:
	 * 스케줄러 배치 알림은 타입별로 1일 1회이므로 rate limit 불필요.
	 * 개별 rate limit 적용 시 배치 전체 성능이 저하됨.
	 */
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
			!isNightExemptNotification(type)
		) {
			return false;
		}

		if (isMarketingNotification(type)) {
			if (!consent?.marketingAgreedAt) {
				return false;
			}
		}

		return true;
	}

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

		this.rateLimiter.destroy?.();
	}
}
