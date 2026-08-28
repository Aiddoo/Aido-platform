import {
	NOTIFICATION_ACTION_TYPE,
	type PushNotificationData,
	USER_PREFERENCE_DEFAULTS,
} from "@aido/validators";
import { type BeforeApplicationShutdown, Inject, Injectable, Logger } from "@nestjs/common";

import { resolveDeliveryTimezone, resolveTimezone } from "@/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE, type SupportedLocale, toSupportedLocale } from "@/shared/domain/locale";
import {
	type CachedUserPreference,
	CacheService,
} from "@/shared/infrastructure/cache/cache.service";

import {
	MARKETING_PUSH_OPT_OUT_TOKEN,
	type MarketingPushOptOutTokenPort,
} from "../../application/ports/marketing-push-opt-out-token.port";
import type { CreateNotificationData } from "../../application/ports/notification-data";
import {
	PUSH_DISPATCH_REPOSITORY,
	type PushDispatchRepositoryPort,
	type PushDispatchSkipReason,
} from "../../application/ports/push-dispatch.repository.port";
import type {
	BatchPushDispatchItem,
	PushDispatcherPort,
} from "../../application/ports/push-dispatcher.port";
import {
	type BatchPushResult,
	PUSH_PROVIDER,
	type PushPayload,
	type PushProvider,
	type PushResult,
} from "../../application/ports/push-provider.port";
import {
	PUSH_RATE_LIMITER,
	type PushRateLimitRequest,
	type PushRateLimiterPort,
} from "../../application/ports/push-rate-limiter.port";
import {
	PUSH_TOKEN_REPOSITORY,
	type PushTokenRepositoryPort,
} from "../../application/ports/push-token.repository.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../../application/ports/user-notification-settings.port";
import type { PushTokenRecord } from "../../domain/records/notification.record";
import {
	FEATURE_DISCOVERY_CAMPAIGN_KEY,
	supportsFeatureDiscoveryMarketing,
} from "../../domain/services/feature-marketing-capability";
import { isNightTime } from "../../domain/services/night-time";
import { toNotificationRouting } from "../../domain/services/notification-routing";
import {
	isAutomatedEngagementNotification,
	isMarketingNotification,
	isNightExemptNotification,
} from "../../domain/services/push-eligibility";
import type { NotificationType } from "../../domain/types/notification-type";
import {
	NOTIFICATION_CACHE_TTL_MS,
	NotificationCacheKey,
} from "../cache/notification-cache.keyspace";

/**
 * 발송을 기다리는 라운드 상한.
 *
 * 대기 중인 발송이 또 다른 발송을 낳을 수 있어 한 번으로는 비지 않는다.
 * 무한히 돌면 발송 연쇄 루프가 드러나지 않는다. 도메인 이벤트 드레인과 같은 값을 쓴다.
 */
const MAX_DRAIN_ROUNDS = 25;

/**
 * 발송을 기다리는 시간 상한.
 *
 * 라운드 상한만으로는 부족하다 — 끝나지 않는 프라미스 하나면 첫 라운드에서 영원히 멈춘다.
 * 그러면 종료가 걸리고, 테스트에서는 이 대기가 `beforeEach`에 있어 **엉뚱한 다음 테스트가**
 * 타임아웃으로 죽는다. 여기서 시간을 끊어야 원인이 제자리에서 드러난다.
 */
const DRAIN_TIMEOUT_MS = 15_000;

/**
 * 푸시 발송 디스패처 어댑터(PUSH_DISPATCHER 구현).
 *
 * 푸시 전송 메커니즘과 발송 자격 판단을 소유한다:
 * 토큰 조회(캐시스루)·Expo 배치 발송·무효 토큰 정리·fire-and-forget 추적·종료 대기,
 * 그리고 사용자 설정·야간·마케팅 동의·rate limit 기반 발송 자격 판단.
 */
@Injectable()
export class PushDispatcherAdapter implements PushDispatcherPort, BeforeApplicationShutdown {
	readonly #logger = new Logger(PushDispatcherAdapter.name);
	readonly #pendingPushes = new Set<Promise<void>>();

	constructor(
		@Inject(PUSH_DISPATCH_REPOSITORY)
		private readonly pushDispatchRepository: PushDispatchRepositoryPort,
		@Inject(PUSH_TOKEN_REPOSITORY)
		private readonly pushTokenRepository: PushTokenRepositoryPort,
		@Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
		@Inject(USER_NOTIFICATION_SETTINGS)
		private readonly userSettings: UserNotificationSettingsPort,
		@Inject(PUSH_RATE_LIMITER)
		private readonly rateLimiter: PushRateLimiterPort,
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
	fireAndForgetPush(data: CreateNotificationData, notificationId: number): void {
		const pushPromise = this.#dispatchSingle(data, notificationId).catch((error) => {
			this.#logger.error(`Failed to send push notification: userId=${data.userId}, error=${error}`);
		});
		this.#trackPush(pushPromise);
	}

	async #dispatchSingle(data: CreateNotificationData, notificationId: number): Promise<void> {
		const preference = await this.#loadPreference(data.userId);
		// 미상(UTC) 유저는 한국 우선 서비스 기준 KST로 폴백해 배송 시각·집계를 판정
		const timezone = resolveDeliveryTimezone(preference.timezone);
		const localDate = new Date(`${this.#localDate(timezone)}T00:00:00.000Z`);
		const dispatch = await this.pushDispatchRepository.createPushDispatch({
			notificationId,
			userId: data.userId,
			purpose: data.purpose ?? "TRANSACTIONAL",
			campaignKey: data.campaignKey,
			variantId: data.variantId,
			timezone,
			localDate,
		});
		try {
			const skipReason = await this.#singleEligibilitySkipReason(data, preference);
			if (skipReason) {
				await this.pushDispatchRepository.markPushDispatchSkipped(dispatch.id, skipReason);
				return;
			}

			const tokenResolution = await this.#resolveTokensForData(data);
			if (tokenResolution.skipReason) {
				await this.pushDispatchRepository.markPushDispatchSkipped(
					dispatch.id,
					tokenResolution.skipReason,
				);
				return;
			}

			const result = await this.#sendPushToUser(data.userId, tokenResolution.tokens, {
				title: data.title,
				body: data.body,
				data: {
					...this.#buildPushPayloadData(data, notificationId),
					dispatchId: dispatch.id,
				},
				...((data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type)) && {
					categoryId: "MARKETING",
				}),
			});
			await this.pushDispatchRepository.recordPushDeliveryResults(dispatch.id, result.results);
		} catch (error) {
			await this.#markUnexpectedDispatchFailure([dispatch.id], error);
			throw error;
		}
	}

	/**
	 * 여러 사용자에게 푸시 발송 (fire-and-forget)
	 *
	 * N+1 쿼리 최적화: 사용자별 설정을 배치로 한 번에 조회
	 */
	fireAndForgetBatchPush(items: BatchPushDispatchItem[]): void {
		const pushPromise = this.#sendBatchPush(items).catch((error) => {
			this.#logger.error(`Failed to send batch push notifications: error=${error}`);
		});
		this.#trackPush(pushPromise);
	}

	async #sendBatchPush(items: BatchPushDispatchItem[]): Promise<void> {
		const dataList = items.map((item) => item.data);
		const userIds = [...new Set(dataList.map((d) => d.userId))];

		const [preferences, consents] = await Promise.all([
			this.userSettings.getPreferenceRecordsByUserIds(userIds),
			this.userSettings.getConsentRecordsByUserIds(userIds),
		]);

		const prefMap = new Map(preferences.map((p) => [p.userId, p]));
		const consentMap = new Map(consents.map((c) => [c.userId, c]));

		let createdDispatchIds: number[] = [];
		try {
			const dispatchRecords = await this.pushDispatchRepository.createPushDispatches(
				items.map((item) => {
					const preference = prefMap.get(item.data.userId);
					const timezone = resolveDeliveryTimezone(preference?.timezone);
					return {
						notificationId: item.notificationId,
						userId: item.data.userId,
						purpose: item.data.purpose ?? "TRANSACTIONAL",
						campaignKey: item.data.campaignKey,
						variantId: item.data.variantId,
						timezone,
						localDate: new Date(`${this.#localDate(timezone)}T00:00:00.000Z`),
					};
				}),
			);
			createdDispatchIds = dispatchRecords.map((dispatch) => dispatch.id);
			const dispatchIdByNotificationId = new Map(
				dispatchRecords.map((dispatch) => [dispatch.notificationId, dispatch.id]),
			);
			const dispatchItems: Array<(typeof items)[number] & { dispatchId: number }> = [];
			for (const item of items) {
				const dispatchId = dispatchIdByNotificationId.get(item.notificationId);
				if (dispatchId === undefined) {
					throw new Error(
						`Push dispatch batch result missing: notificationId=${item.notificationId}`,
					);
				}
				dispatchItems.push({ ...item, dispatchId });
			}

			const settingsEligibleItems: typeof dispatchItems = [];
			const skippedDispatches: Array<{
				dispatchId: number;
				reason: PushDispatchSkipReason;
			}> = [];
			for (const item of dispatchItems) {
				const { data } = item;
				// 관리자 강제 발송(force)은 수신 설정·야간·설정 행 부재를 우회한다.
				// 마케팅성 알림은 수신 동의가 법적 요건이므로 강제 대상에서 제외.
				const forced =
					data.force === true &&
					data.purpose !== "ENGAGEMENT" &&
					!isMarketingNotification(data.type);
				const skipReason = forced
					? null
					: this.#cachedSettingsSkipReason(
							data.type,
							data.purpose,
							prefMap.get(data.userId),
							consentMap.get(data.userId),
						);
				if (!skipReason) {
					settingsEligibleItems.push(item);
				} else {
					skippedDispatches.push({
						dispatchId: item.dispatchId,
						reason: skipReason,
					});
					this.#logger.debug(
						`Push dispatch skipped: userId=${data.userId}, type=${data.type}, reason=${skipReason}`,
					);
				}
			}

			if (settingsEligibleItems.length === 0) {
				await this.pushDispatchRepository.markPushDispatchesSkipped(skippedDispatches);
				return;
			}

			const rateLimitRequests = settingsEligibleItems.map(({ data }) =>
				this.#buildRateLimitRequest(data, prefMap.get(data.userId)?.timezone),
			);
			const limited = await this.rateLimiter.reserveBatch(rateLimitRequests);
			const eligibleItems: typeof settingsEligibleItems = [];
			for (const [index, item] of settingsEligibleItems.entries()) {
				const isLimited = limited[index] ?? false;
				if (isLimited) {
					skippedDispatches.push({
						dispatchId: item.dispatchId,
						reason: "RATE_LIMITED",
					});
					this.#logger.debug(
						`Push rate limited: userId=${item.data.userId}, type=${item.data.type}`,
					);
				} else {
					eligibleItems.push(item);
				}
			}
			await this.pushDispatchRepository.markPushDispatchesSkipped(skippedDispatches);

			if (eligibleItems.length === 0) return;

			const { attemptedDispatchIds, resultsByDispatch } = await this.#sendPushToUsers(
				eligibleItems.map(({ data: d, notificationId, dispatchId }) => ({
					userId: d.userId,
					dispatchId,
					requiresFeatureCapability: d.campaignKey === FEATURE_DISCOVERY_CAMPAIGN_KEY,
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
			await this.pushDispatchRepository.recordPushDeliveryResultsBatch(
				[...attemptedDispatchIds].map((dispatchId) => ({
					dispatchId,
					results: resultsByDispatch.get(dispatchId) ?? [],
				})),
			);
		} catch (error) {
			await this.#markUnexpectedDispatchFailure(createdDispatchIds, error);
			throw error;
		}
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
					morningReminderMinute: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE,
					eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
					eveningReminderMinute: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE,
					timeFormat: USER_PREFERENCE_DEFAULTS.TIME_FORMAT,
					weatherMorningEnabled: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_ENABLED,
					weatherMorningHour: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_HOUR,
					weatherMorningMinute: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_MINUTE,
					weatherEveningEnabled: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_ENABLED,
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
		return (
			(await this.#singleEligibilitySkipReason(
				{ userId, type, purpose, title: "", body: "" },
				preference,
			)) === null
		);
	}

	async #singleEligibilitySkipReason(
		data: CreateNotificationData,
		preference: CachedUserPreference,
	): Promise<PushDispatchSkipReason | null> {
		if (!preference.pushEnabled) {
			return "PUSH_DISABLED";
		}

		// Rate limit은 Redis O(1) — 캐시/DB 조회보다 먼저 체크하여 불필요한 연산 방지
		if (await this.rateLimiter.isRateLimited(data.userId)) {
			this.#logger.debug(`Push rate limited: userId=${data.userId}, type=${data.type}`);
			return "RATE_LIMITED";
		}

		const isEngagement =
			data.purpose === "ENGAGEMENT" || isAutomatedEngagementNotification(data.type);
		const isMarketing = data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type);

		// 야간(정보통신망법 21:00–08:00)·집계는 지역 기준이므로 배송 폴백(미상→KST)으로 판정.
		// locale과 무관 — 영어를 쓰는 한국 유저(locale=en, tz=Asia/Seoul)도 KST 게이트가 적용된다.
		const deliveryTz = resolveDeliveryTimezone(preference.timezone);

		if (isNightTime(deliveryTz) && isMarketing) {
			return "MARKETING_QUIET_HOURS";
		}

		if (
			isNightTime(deliveryTz) &&
			!preference.nightPushEnabled &&
			!isNightExemptNotification(data.type)
		) {
			return "NIGHT_PUSH_DISABLED";
		}

		if (isMarketing) {
			const consent = await this.userSettings.getConsentRecord(data.userId);
			if (!consent?.marketingPushAgreedAt) {
				return "MARKETING_CONSENT_REQUIRED";
			}
		}

		if (
			isEngagement &&
			(await this.rateLimiter.isEngagementRateLimited(data.userId, this.#localDate(deliveryTz)))
		) {
			return "ENGAGEMENT_RATE_LIMITED";
		}

		return null;
	}

	/**
	 * 배치 경로용 푸시 발송 판단 (설정 + 마케팅 동의).
	 * Redis 제한 예약은 이 사전 필터를 통과한 항목만 별도의 단일 배치로 수행합니다.
	 */
	#cachedSettingsSkipReason(
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
	): PushDispatchSkipReason | null {
		if (!preference) {
			return "PUSH_SETTINGS_MISSING";
		}

		if (!preference.pushEnabled) {
			return "PUSH_DISABLED";
		}

		const timezone = resolveDeliveryTimezone(preference.timezone);
		const isMarketing = purpose === "ENGAGEMENT" || isMarketingNotification(type);

		if (isNightTime(timezone) && isMarketing) {
			return "MARKETING_QUIET_HOURS";
		}

		if (isNightTime(timezone) && !preference.nightPushEnabled && !isNightExemptNotification(type)) {
			return "NIGHT_PUSH_DISABLED";
		}

		if (isMarketing) {
			if (!consent?.marketingPushAgreedAt) {
				return "MARKETING_CONSENT_REQUIRED";
			}
		}

		return null;
	}

	#buildRateLimitRequest(
		data: CreateNotificationData,
		timezone: string | undefined,
	): PushRateLimitRequest {
		const isEngagement =
			data.purpose === "ENGAGEMENT" || isAutomatedEngagementNotification(data.type);
		return {
			userId: data.userId,
			...(isEngagement && {
				engagementLocalDate: this.#localDate(resolveDeliveryTimezone(timezone)),
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
		if (data.todoId) {
			context.todoId = data.todoId;
		}
		if (data.friendId) {
			context.friendId = data.friendId;
		}
		if (data.nudgeId) {
			context.nudgeId = data.nudgeId;
		}
		if (data.cheerId) {
			context.cheerId = data.cheerId;
		}
		const routing = toNotificationRouting(data.metadata);

		return {
			notificationId: notificationId ?? 0,
			type: data.type,
			action: {
				type: action.type,
				...(action.url && { url: action.url }),
			},
			...(Object.keys(context).length > 0 && { context }),
			...(routing && { routing }),
			...(data.campaignKey && { campaignKey: data.campaignKey }),
			...(data.variantId && { variantId: data.variantId }),
			...(data.purpose && { purpose: data.purpose }),
			...((data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type)) && {
				marketingOptOutToken: this.marketingOptOutTokens.issue(data.userId),
			}),
		};
	}

	async #sendPushToUser(
		userId: string,
		tokenStrings: string[],
		payload: Omit<PushPayload, "token">,
	): Promise<BatchPushResult> {
		const payloads: PushPayload[] = tokenStrings.map((token) => ({
			...payload,
			token,
		}));

		const result = await this.pushProvider.sendBatch(payloads);

		if (result.invalidTokens.length > 0) {
			await this.pushTokenRepository.deactivateInvalidTokens(result.invalidTokens);
			await this.cacheService.invalidatePushTokens(userId);
			this.#logger.warn(`Deactivated invalid tokens: ${result.invalidTokens.length}`);
		}

		this.#logger.debug(
			`Push sent to user ${userId}: success=${result.successCount}, failure=${result.failureCount}`,
		);
		return result;
	}

	async #resolveTokensForData(data: CreateNotificationData): Promise<{
		tokens: string[];
		skipReason: PushDispatchSkipReason | null;
	}> {
		if (data.campaignKey === FEATURE_DISCOVERY_CAMPAIGN_KEY) {
			const records = await this.pushTokenRepository.findPushTokensByUser({
				userId: data.userId,
				activeOnly: true,
			});
			if (records.length === 0) {
				return { tokens: [], skipReason: "NO_ACTIVE_TOKEN" };
			}
			const capable = records
				.filter(supportsFeatureDiscoveryMarketing)
				.map((record) => record.token);
			return capable.length > 0
				? { tokens: capable, skipReason: null }
				: { tokens: [], skipReason: "UNSUPPORTED_APP_CAPABILITY" };
		}

		const tokens = await this.cacheService.wrapPushTokens(data.userId, async () => {
			const records = await this.pushTokenRepository.findPushTokensByUser({
				userId: data.userId,
				activeOnly: true,
			});
			return records.map((record) => record.token);
		});
		return tokens.length > 0
			? { tokens, skipReason: null }
			: { tokens: [], skipReason: "NO_ACTIVE_TOKEN" };
	}

	async #sendPushToUsers(
		payloads: Array<
			{
				userId: string;
				dispatchId: number;
				requiresFeatureCapability: boolean;
			} & Omit<PushPayload, "token">
		>,
	): Promise<{
		attemptedDispatchIds: Set<number>;
		resultsByDispatch: Map<number, PushResult[]>;
	}> {
		const userIds = [...new Set(payloads.map((payload) => payload.userId))];
		const tokensByUser = await this.#resolveTokensByUsers(userIds);
		const featureUserIds = [
			...new Set(
				payloads
					.filter((payload) => payload.requiresFeatureCapability)
					.map((payload) => payload.userId),
			),
		];
		const featureTokenRecords =
			featureUserIds.length === 0
				? []
				: await this.pushTokenRepository.findActivePushTokensByUsers(featureUserIds);
		const featureTokensByUser = this.#groupTokenRecords(featureTokenRecords);

		const pushPayloads: PushPayload[] = [];
		const dispatchIds: number[] = [];
		const attemptedDispatchIds = new Set<number>();
		for (const payload of payloads) {
			const activeTokenStrings = tokensByUser.get(payload.userId) ?? [];
			const featureRecords = featureTokensByUser.get(payload.userId) ?? [];
			const activeTokenCount = payload.requiresFeatureCapability
				? featureRecords.length
				: activeTokenStrings.length;
			if (activeTokenCount === 0) {
				await this.pushDispatchRepository.markPushDispatchSkipped(
					payload.dispatchId,
					"NO_ACTIVE_TOKEN",
				);
				continue;
			}
			const userTokenStrings = payload.requiresFeatureCapability
				? featureRecords.filter(supportsFeatureDiscoveryMarketing).map((record) => record.token)
				: activeTokenStrings;
			if (userTokenStrings.length === 0) {
				await this.pushDispatchRepository.markPushDispatchSkipped(
					payload.dispatchId,
					"UNSUPPORTED_APP_CAPABILITY",
				);
				continue;
			}
			attemptedDispatchIds.add(payload.dispatchId);
			for (const token of userTokenStrings) {
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
			return {
				attemptedDispatchIds,
				resultsByDispatch: new Map<number, PushResult[]>(),
			};
		}

		const result = await this.pushProvider.sendBatch(pushPayloads);

		if (result.invalidTokens.length > 0) {
			await this.pushTokenRepository.deactivateInvalidTokens(result.invalidTokens);
			await Promise.all(userIds.map((uid) => this.cacheService.invalidatePushTokens(uid)));
			this.#logger.warn(`Deactivated invalid tokens: ${result.invalidTokens.length}`);
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
		return { attemptedDispatchIds, resultsByDispatch };
	}

	/**
	 * scatter-gather 패턴으로 다수 사용자의 푸시 토큰 조회
	 *
	 * 1) mget: 1회 Redis 호출로 모든 사용자 토큰 조회
	 * 2) 캐시 미스분만 배치 DB 쿼리 1회
	 * 3) mset: 1회 Redis 호출로 캐시 적재 (negative cache 포함)
	 */
	async #resolveTokensByUsers(userIds: string[]): Promise<Map<string, string[]>> {
		const tokensByUser = new Map<string, string[]>();

		const cacheKeys = userIds.map((uid) => NotificationCacheKey.pushTokens(uid));
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
			const dbTokens = await this.pushTokenRepository.findActivePushTokensByUsers(missedUserIds);

			const dbTokensByUser = new Map<string, string[]>();
			for (const t of dbTokens) {
				const arr = dbTokensByUser.get(t.userId) ?? [];
				arr.push(t.token);
				dbTokensByUser.set(t.userId, arr);
			}

			await this.cacheService.mset(
				missedUserIds.map((uid) => ({
					key: NotificationCacheKey.pushTokens(uid),
					value: dbTokensByUser.get(uid) ?? [],
					ttl: NOTIFICATION_CACHE_TTL_MS.PUSH_TOKENS,
				})),
			);

			for (const [uid, tokens] of dbTokensByUser) {
				tokensByUser.set(uid, tokens);
			}
		}

		return tokensByUser;
	}

	#groupTokenRecords(records: PushTokenRecord[]): Map<string, PushTokenRecord[]> {
		const byUserId = new Map<string, PushTokenRecord[]>();
		for (const record of records) {
			const userRecords = byUserId.get(record.userId) ?? [];
			userRecords.push(record);
			byUserId.set(record.userId, userRecords);
		}
		return byUserId;
	}

	async #markUnexpectedDispatchFailure(
		dispatchIds: number[],
		originalError: unknown,
	): Promise<void> {
		if (dispatchIds.length === 0) return;
		try {
			await this.pushDispatchRepository.markPushDispatchFailed(
				dispatchIds,
				"UNEXPECTED_DISPATCH_ERROR",
			);
		} catch (transitionError) {
			this.#logger.error(
				`Failed to mark push dispatches FAILED: dispatchIds=${dispatchIds.join(",")}, originalError=${originalError}, transitionError=${transitionError}`,
			);
		}
	}

	#trackPush(promise: Promise<void>): void {
		this.#pendingPushes.add(promise);
		promise.finally(() => this.#pendingPushes.delete(promise));
	}

	/**
	 * 진행 중인 fire-and-forget 발송을 모두 기다린다.
	 *
	 * 두 가지로 스스로를 묶는다 — 라운드 상한(발송이 발송을 낳는 연쇄)과
	 * 시간 상한(끝나지 않는 프라미스 하나). 둘 중 하나라도 걸리면 조용히
	 * 매달리는 대신 던져서, 무엇이 남았는지 그 자리에서 드러나게 한다.
	 *
	 * @param timeoutMs 기다릴 시간 상한. 테스트가 짧게 좁혀 쓴다.
	 * @throws {Error} 라운드 또는 시간 상한을 넘긴 경우
	 */
	async drainPendingPushes(timeoutMs: number = DRAIN_TIMEOUT_MS): Promise<void> {
		if (this.#pendingPushes.size === 0) return;

		this.#logger.log(`Waiting for ${this.#pendingPushes.size} pending push(es)...`);

		let expire: ReturnType<typeof setTimeout> | undefined;
		const deadline = new Promise<never>((_resolve, reject) => {
			expire = setTimeout(() => {
				reject(
					new Error(
						`Push drain exceeded ${timeoutMs}ms — ${this.#pendingPushes.size}건이 정착하지 않았다`,
					),
				);
			}, timeoutMs);
			// 이 타이머만 남아 프로세스를 붙잡지 않게 한다.
			expire.unref?.();
		});

		try {
			await Promise.race([this.#settlePendingPushes(), deadline]);
			this.#logger.log("All pending pushes completed");
		} finally {
			clearTimeout(expire);
		}
	}

	/** 대기 집합이 빌 때까지 라운드를 돈다. 연쇄가 끝나지 않으면 던진다. */
	async #settlePendingPushes(): Promise<void> {
		for (let round = 0; round < MAX_DRAIN_ROUNDS; round += 1) {
			await Promise.allSettled([...this.#pendingPushes]);
			if (this.#pendingPushes.size === 0) return;
		}

		throw new Error(
			`Push drain exceeded ${MAX_DRAIN_ROUNDS} rounds — ${this.#pendingPushes.size}건이 남아 발송 연쇄 루프가 의심된다`,
		);
	}

	async beforeApplicationShutdown(): Promise<void> {
		// 종료는 실패로 끝나면 안 되지만 매달려서도 안 된다 — 남은 발송은 기록만 남기고 넘어간다.
		try {
			await this.drainPendingPushes();
		} catch (error) {
			this.#logger.warn(`Shutting down with pending pushes unresolved: ${error}`);
		}
		this.rateLimiter.destroy?.();
	}
}
