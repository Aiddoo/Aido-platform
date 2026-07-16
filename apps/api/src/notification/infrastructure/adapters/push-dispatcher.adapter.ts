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
import { resolveTimezone } from "@/shared/domain/date/utils/timezone";
import {
	type CachedUserPreference,
	CacheService,
} from "@/shared/infrastructure/cache/cache.service";
import { CacheKeys } from "@/shared/infrastructure/cache/constants/cache-keys";
import {
	DEFAULT_LOCALE,
	type SupportedLocale,
	toSupportedLocale,
} from "@/shared/presentation/decorators";
import {
	MARKETING_PUSH_OPT_OUT_TOKEN,
	type MarketingPushOptOutTokenPort,
} from "../../application/ports/marketing-push-opt-out-token.port";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../application/ports/notification.repository.port";
import type { CreateNotificationData } from "../../application/ports/notification-data";
import type { PushDispatcherPort } from "../../application/ports/push-dispatcher.port";
import {
	type BatchPushResult,
	PUSH_PROVIDER,
	type PushPayload,
	type PushProvider,
	type PushResult,
} from "../../application/ports/push-provider.port";
import {
	type IPushRateLimiter,
	PUSH_RATE_LIMITER,
	type PushRateLimitRequest,
} from "../../application/ports/push-rate-limiter.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../../application/ports/user-notification-settings.port";
import { isNightTime } from "../../domain/services/night-time";
import {
	isAutomatedEngagementNotification,
	isMarketingNotification,
	isNightExemptNotification,
} from "../../domain/services/push-eligibility";
import type { NotificationType } from "../../domain/types/notification-type";

/**
 * 푸시 발송 디스패처 어댑터(PUSH_DISPATCHER 구현).
 *
 * 푸시 전송 메커니즘과 발송 자격 판단을 소유한다:
 * 토큰 조회(캐시스루)·Expo 배치 발송·무효 토큰 정리·fire-and-forget 추적·종료 대기,
 * 그리고 사용자 설정·야간·마케팅 동의·rate limit 기반 발송 자격 판단.
 */
@Injectable()
export class PushDispatcherAdapter
	implements PushDispatcherPort, BeforeApplicationShutdown
{
	readonly #logger = new Logger(PushDispatcherAdapter.name);
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
		@Inject(MARKETING_PUSH_OPT_OUT_TOKEN)
		private readonly marketingOptOutTokens: MarketingPushOptOutTokenPort,
	) {}

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
		const pushPromise = this.#dispatchSingle(data, notificationId).catch(
			(error) => {
				this.#logger.error(
					`Failed to send push notification: userId=${data.userId}, error=${error}`,
				);
			},
		);
		this.#trackPush(pushPromise);
	}

	async #dispatchSingle(
		data: CreateNotificationData,
		notificationId: number,
	): Promise<void> {
		const preference = await this.#loadPreference(data.userId);
		const timezone = resolveTimezone(preference.timezone);
		const localDate = new Date(`${this.#localDate(timezone)}T00:00:00.000Z`);
		const dispatch = await this.notificationRepository.createPushDispatch({
			notificationId,
			userId: data.userId,
			purpose: data.purpose ?? "TRANSACTIONAL",
			campaignKey: data.campaignKey,
			variantId: data.variantId,
			timezone,
			localDate,
		});
		const result = await this.#sendPushToUser(data.userId, {
			title: data.title,
			body: data.body,
			data: {
				...this.#buildPushPayloadData(data, notificationId),
				dispatchId: dispatch.id,
			},
			...((data.purpose === "ENGAGEMENT" ||
				isMarketingNotification(data.type)) && {
				categoryId: "MARKETING",
			}),
		});
		await this.notificationRepository.recordPushDeliveryResults(
			dispatch.id,
			result.results,
		);
	}

	/**
	 * 여러 사용자에게 푸시 발송 (fire-and-forget)
	 *
	 * N+1 쿼리 최적화: 사용자별 설정을 배치로 한 번에 조회
	 */
	fireAndForgetBatchPush(
		items: Array<{ data: CreateNotificationData; notificationId: number }>,
	): void {
		const pushPromise = this.#sendBatchPush(items).catch((error) => {
			this.#logger.error(
				`Failed to send batch push notifications: error=${error}`,
			);
		});
		this.#trackPush(pushPromise);
	}

	async #sendBatchPush(
		items: Array<{ data: CreateNotificationData; notificationId: number }>,
	): Promise<void> {
		const dataList = items.map((item) => item.data);
		const userIds = [...new Set(dataList.map((d) => d.userId))];

		const [preferences, consents] = await Promise.all([
			this.userSettings.getPreferenceRecordsByUserIds(userIds),
			this.userSettings.getConsentRecordsByUserIds(userIds),
		]);

		const prefMap = new Map(preferences.map((p) => [p.userId, p]));
		const consentMap = new Map(consents.map((c) => [c.userId, c]));

		const settingsEligibleItems: typeof items = [];
		for (const item of items) {
			const { data } = item;
			const shouldSend = this.#passesCachedSettings(
				data.type,
				data.purpose,
				prefMap.get(data.userId),
				consentMap.get(data.userId),
			);
			if (shouldSend) {
				settingsEligibleItems.push(item);
			} else {
				this.#logger.debug(
					`Push notification skipped due to user settings: userId=${data.userId}, type=${data.type}`,
				);
			}
		}

		if (settingsEligibleItems.length === 0) {
			return;
		}

		const rateLimitRequests = settingsEligibleItems.map(({ data }) =>
			this.#buildRateLimitRequest(data, prefMap.get(data.userId)?.timezone),
		);
		const limited = await this.rateLimiter.reserveBatch(rateLimitRequests);
		const eligibleItems = settingsEligibleItems.filter((item, index) => {
			const isLimited = limited[index] ?? false;
			if (isLimited) {
				this.#logger.debug(
					`Push rate limited: userId=${item.data.userId}, type=${item.data.type}`,
				);
			}
			return !isLimited;
		});

		if (eligibleItems.length === 0) return;

		const eligibleUserIds = [
			...new Set(eligibleItems.map((item) => item.data.userId)),
		];

		const dispatchItems = await Promise.all(
			eligibleItems.map(async (item) => {
				const preference = prefMap.get(item.data.userId);
				const timezone = resolveTimezone(preference?.timezone);
				const dispatch = await this.notificationRepository.createPushDispatch({
					notificationId: item.notificationId,
					userId: item.data.userId,
					purpose: item.data.purpose ?? "TRANSACTIONAL",
					campaignKey: item.data.campaignKey,
					variantId: item.data.variantId,
					timezone,
					localDate: new Date(`${this.#localDate(timezone)}T00:00:00.000Z`),
				});
				return { ...item, dispatchId: dispatch.id };
			}),
		);

		const resultsByDispatch = await this.#sendPushToUsers(
			eligibleUserIds,
			dispatchItems.map(({ data: d, notificationId, dispatchId }) => ({
				userId: d.userId,
				dispatchId,
				title: d.title,
				body: d.body,
				data: {
					...this.#buildPushPayloadData(d, notificationId),
					dispatchId,
				},
				...((d.purpose === "ENGAGEMENT" || isMarketingNotification(d.type)) && {
					categoryId: "MARKETING",
				}),
			})),
		);
		await Promise.all(
			dispatchItems.map(({ dispatchId }) =>
				this.notificationRepository.recordPushDeliveryResults(
					dispatchId,
					resultsByDispatch.get(dispatchId) ?? [],
				),
			),
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
		purpose?: CreateNotificationData["purpose"],
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

		const isEngagement =
			purpose === "ENGAGEMENT" || isAutomatedEngagementNotification(type);
		const isMarketing =
			purpose === "ENGAGEMENT" || isMarketingNotification(type);

		if (isNightTime(preference.timezone) && isMarketing) {
			return false;
		}

		if (
			isNightTime(preference.timezone) &&
			!preference.nightPushEnabled &&
			!isNightExemptNotification(type)
		) {
			return false;
		}

		if (isMarketing) {
			const consent = await this.userSettings.getConsentRecord(userId);
			if (!consent?.marketingPushAgreedAt) {
				return false;
			}
		}

		if (
			isEngagement &&
			(await this.rateLimiter.isEngagementRateLimited(
				userId,
				this.#localDate(preference.timezone),
			))
		) {
			return false;
		}

		return true;
	}

	/**
	 * 배치 경로용 푸시 발송 판단 (설정 + 마케팅 동의).
	 * Redis 제한 예약은 이 사전 필터를 통과한 항목만 별도의 단일 배치로 수행합니다.
	 */
	#passesCachedSettings(
		type: NotificationType,
		purpose: CreateNotificationData["purpose"],
		preference:
			| {
					pushEnabled: boolean;
					nightPushEnabled: boolean;
					timezone?: string;
			  }
			| undefined,
		consent: { marketingPushAgreedAt: Date | null } | undefined,
	): boolean {
		if (!preference) {
			return false;
		}

		if (!preference.pushEnabled) {
			return false;
		}

		const timezone = preference.timezone ?? "UTC";
		const isMarketing =
			purpose === "ENGAGEMENT" || isMarketingNotification(type);

		if (isNightTime(timezone) && isMarketing) {
			return false;
		}

		if (
			isNightTime(timezone) &&
			!preference.nightPushEnabled &&
			!isNightExemptNotification(type)
		) {
			return false;
		}

		if (isMarketing) {
			if (!consent?.marketingPushAgreedAt) {
				return false;
			}
		}

		return true;
	}

	#buildRateLimitRequest(
		data: CreateNotificationData,
		timezone: string | undefined,
	): PushRateLimitRequest {
		const isEngagement =
			data.purpose === "ENGAGEMENT" ||
			isAutomatedEngagementNotification(data.type);
		return {
			userId: data.userId,
			...(isEngagement && {
				engagementLocalDate: this.#localDate(timezone ?? "UTC"),
			}),
		};
	}

	#localDate(timezone: string): string {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone: resolveTimezone(timezone),
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(new Date());
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
			...(data.campaignKey && { campaignKey: data.campaignKey }),
			...(data.variantId && { variantId: data.variantId }),
			...(data.purpose && { purpose: data.purpose }),
			...((data.purpose === "ENGAGEMENT" ||
				isMarketingNotification(data.type)) && {
				marketingOptOutToken: this.marketingOptOutTokens.issue(data.userId),
			}),
		};
	}

	async #sendPushToUser(
		userId: string,
		payload: Omit<PushPayload, "token">,
	): Promise<BatchPushResult> {
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
			return {
				total: 0,
				successCount: 0,
				failureCount: 0,
				results: [],
				invalidTokens: [],
			};
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
		return result;
	}

	async #sendPushToUsers(
		userIds: string[],
		payloads: Array<
			{ userId: string; dispatchId: number } & Omit<PushPayload, "token">
		>,
	): Promise<Map<number, PushResult[]>> {
		const empty = new Map<number, PushResult[]>();
		const tokensByUser = await this.#resolveTokensByUsers(userIds);

		if (tokensByUser.size === 0) {
			this.#logger.debug("No active push tokens for users");
			return empty;
		}

		const pushPayloads: PushPayload[] = [];
		const dispatchIds: number[] = [];
		for (const payload of payloads) {
			const userTokens = tokensByUser.get(payload.userId) ?? [];
			for (const token of userTokens) {
				pushPayloads.push({
					token,
					title: payload.title,
					body: payload.body,
					data: payload.data,
				});
				dispatchIds.push(payload.dispatchId);
			}
		}

		if (pushPayloads.length === 0) {
			return empty;
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

		const resultsByDispatch = new Map<number, PushResult[]>();
		for (const [index, pushResult] of result.results.entries()) {
			const dispatchId = dispatchIds[index];
			if (dispatchId === undefined) continue;
			const current = resultsByDispatch.get(dispatchId) ?? [];
			current.push(pushResult);
			resultsByDispatch.set(dispatchId, current);
		}
		return resultsByDispatch;
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
