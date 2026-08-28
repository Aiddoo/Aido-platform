/** 기존 단건·배치 전달의 eligibility, 상태 기록, payload 계약 골든 테스트. */
import { pushNotificationDataSchema } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createNotificationCacheMock } from "@test/mocks/ports/notification-cache.mock";
import {
	createActivePushTokenReaderMock,
	createNotificationRecipientPreferenceReaderMock,
} from "@test/mocks/ports/notification.mock";
import { z } from "zod";

import type { UserConsentRecordWithId, UserPreferenceRecordWithId } from "@/user-settings";

import {
	ACTIVE_PUSH_TOKEN_READER,
	type ActivePushTokenReaderPort,
} from "../../ports/active-push-token.reader.port";
import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import {
	NOTIFICATION_RECIPIENT_PREFERENCE_READER,
	type NotificationRecipientPreferenceReaderPort,
} from "../../ports/notification-recipient-preference.reader.port";
import {
	PUSH_DISPATCH_REPOSITORY,
	type PushDispatchRepositoryPort,
} from "../../ports/push-dispatch.repository.port";
import { PUSH_PROVIDER, type PushProvider } from "../../ports/push-provider.port";
import { PUSH_RATE_LIMITER, type PushRateLimiterPort } from "../../ports/push-rate-limiter.port";
import {
	PUSH_TOKEN_REPOSITORY,
	type PushTokenRepositoryPort,
} from "../../ports/push-token.repository.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../../ports/user-notification-settings.port";
import { PushDeliveryEligibilityService } from "../../services/push-delivery-eligibility.service";
import { PushNotificationDeliveryService } from "../../services/push-notification-delivery.service";
import { PushNotificationPayloadFactory } from "../../services/push-notification-payload.factory";
import { DeliverPushNotificationsUseCase } from "./deliver-push-notifications.use-case";

/** v1.0.0~v1.1.x 릴리스의 실제 NOTIFICATION_TYPE enum. */
const LEGACY_V1_0_NOTIFICATION_TYPES = [
	"FOLLOW_NEW",
	"FOLLOW_ACCEPTED",
	"NUDGE_RECEIVED",
	"CHEER_RECEIVED",
	"DAILY_COMPLETE",
	"FRIEND_COMPLETED",
	"TODO_REMINDER",
	"TODO_SHARED",
	"MORNING_REMINDER",
	"EVENING_REMINDER",
	"WEEKLY_ACHIEVEMENT",
	"WEEKLY_REPORT",
	"MONTHLY_REPORT",
	"AI_SUGGESTION",
	"SYSTEM_NOTICE",
	"ADMIN_BROADCAST",
	"ADMIN_TARGETED",
	"WINBACK",
	"SOCIAL_DIGEST",
	"NUDGE_SUGGEST",
	"LUNCH_NUDGE",
	"STREAK_AT_RISK",
] as const;

/** v1.2.0~v1.8.2에서 위 enum에 추가된 날씨 알림 타입. */
const LEGACY_V1_2_NOTIFICATION_TYPES = [
	...LEGACY_V1_0_NOTIFICATION_TYPES,
	"WEATHER_MORNING",
	"WEATHER_EVENING",
] as const;

function legacyPushDataSchema(notificationTypes: readonly [string, ...string[]]) {
	return z.object({
		notificationId: z.number(),
		type: z.enum(notificationTypes),
		action: z.object({
			type: z.enum(["DEEP_LINK", "BROWSER", "WEBVIEW", "NONE"]),
			url: z.string().optional(),
		}),
		context: z
			.object({
				todoId: z.number().optional(),
				friendId: z.string().optional(),
				nudgeId: z.number().optional(),
				cheerId: z.number().optional(),
			})
			.optional(),
	});
}

const LEGACY_PUSH_DATA_SCHEMAS = {
	V1_0_TO_V1_1: legacyPushDataSchema(LEGACY_V1_0_NOTIFICATION_TYPES),
	V1_2_TO_V1_8_2: legacyPushDataSchema(LEGACY_V1_2_NOTIFICATION_TYPES),
} as const;

/** 2026-07-16 12:00 KST — 마케팅 야간 게이트 밖의 결정적인 테스트 시각. */
const KST_MARKETING_DAYTIME = new Date("2026-07-16T03:00:00.000Z");

function makePreference(userId: string, timezone: string): UserPreferenceRecordWithId {
	return {
		userId,
		pushEnabled: true,
		nightPushEnabled: true,
		timezone,
		locale: "ko",
		morningReminderHour: 8,
		morningReminderMinute: 0,
		eveningReminderHour: 19,
		eveningReminderMinute: 0,
		timeFormat: "TWENTY_FOUR_HOUR",
		weatherMorningEnabled: true,
		weatherMorningHour: 7,
		weatherMorningMinute: 0,
		weatherEveningEnabled: true,
		weatherEveningHour: 17,
		weatherEveningMinute: 30,
		currentStreak: 0,
		longestStreak: 0,
		lastCompletedDate: null,
	};
}

function makeConsent(userId: string): UserConsentRecordWithId {
	const agreedAt = new Date("2026-07-01T00:00:00.000Z");
	return {
		userId,
		termsAgreedAt: agreedAt,
		privacyAgreedAt: agreedAt,
		agreedTermsVersion: "1.0",
		marketingAgreedAt: agreedAt,
		marketingPushAgreedAt: agreedAt,
	};
}

describe("DeliverPushNotificationsUseCase", () => {
	let useCase: DeliverPushNotificationsUseCase;
	let userSettings: Mocked<UserNotificationSettingsPort>;
	let rateLimiter: Mocked<PushRateLimiterPort>;
	let activePushTokenReader: Mocked<ActivePushTokenReaderPort>;
	let recipientPreferenceReader: Mocked<NotificationRecipientPreferenceReaderPort>;
	let notificationCache: Mocked<NotificationCachePort>;
	let repository: Mocked<PushDispatchRepositoryPort>;
	let tokenRepository: Mocked<PushTokenRepositoryPort>;
	let pushProvider: Mocked<PushProvider>;

	beforeEach(async () => {
		const { unit: eligibility, unitRef: eligibilityRef } = await TestBed.solitary(
			PushDeliveryEligibilityService,
		)
			.mock<NotificationRecipientPreferenceReaderPort>(NOTIFICATION_RECIPIENT_PREFERENCE_READER)
			.impl(() => createNotificationRecipientPreferenceReaderMock())
			.compile();
		const { unit: payloadFactory } = await TestBed.solitary(
			PushNotificationPayloadFactory,
		).compile();
		const { unit: delivery, unitRef: deliveryRef } = await TestBed.solitary(
			PushNotificationDeliveryService,
		)
			.mock<ActivePushTokenReaderPort>(ACTIVE_PUSH_TOKEN_READER)
			.impl(() => createActivePushTokenReaderMock())
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.compile();
		const { unitRef } = await TestBed.solitary(DeliverPushNotificationsUseCase).compile();
		userSettings = eligibilityRef.get(USER_NOTIFICATION_SETTINGS);
		rateLimiter = eligibilityRef.get(PUSH_RATE_LIMITER);
		activePushTokenReader = deliveryRef.get(ACTIVE_PUSH_TOKEN_READER);
		recipientPreferenceReader = eligibilityRef.get(NOTIFICATION_RECIPIENT_PREFERENCE_READER);
		notificationCache = deliveryRef.get(NOTIFICATION_CACHE);
		repository = unitRef.get(PUSH_DISPATCH_REPOSITORY);
		tokenRepository = deliveryRef.get(PUSH_TOKEN_REPOSITORY);
		pushProvider = deliveryRef.get(PUSH_PROVIDER);
		useCase = new DeliverPushNotificationsUseCase(
			repository,
			eligibility,
			payloadFactory,
			delivery,
		);

		notificationCache.invalidatePushTokens.mockResolvedValue(undefined);
		activePushTokenReader.findByUserId.mockResolvedValue([]);
		activePushTokenReader.findByUserIds.mockResolvedValue(new Map());
		repository.createPushDispatches.mockImplementation((inputs) =>
			Promise.all(
				inputs.map(async (input) => {
					const dispatch = await repository.createPushDispatch(input);
					return { id: dispatch.id, notificationId: input.notificationId };
				}),
			),
		);
		repository.markPushDispatchesSkipped.mockImplementation(async (updates) => {
			await Promise.all(
				updates.map((update) =>
					repository.markPushDispatchSkipped(update.dispatchId, update.reason),
				),
			);
		});
		repository.recordPushDeliveryResultsBatch.mockImplementation(async (inputs) => {
			await Promise.all(
				inputs.map((input) =>
					repository.recordPushDeliveryResults(input.dispatchId, input.results),
				),
			);
		});
	});

	afterEach(() => jest.useRealTimers());

	describe("배송 타임존 폴백 (미상 유저 KST 게이트)", () => {
		// 2026-07-16T14:00:00Z = KST 23:00(야간) / UTC 14:00(주간) / New_York 10:00(주간)
		const KST_NIGHT_UTC_DAY = new Date("2026-07-16T14:00:00.000Z");

		it("미상(UTC 저장) 유저는 KST 야간이면 야간 게이트로 차단된다", async () => {
			jest.useFakeTimers().setSystemTime(KST_NIGHT_UTC_DAY);
			recipientPreferenceReader.getPreference.mockResolvedValue({
				...makePreference("user-1", "UTC"),
				nightPushEnabled: false,
			});
			rateLimiter.isRateLimited.mockResolvedValue(false);
			repository.createPushDispatch.mockResolvedValue({ id: 1 });

			await useCase.execute({
				mode: "single",
				item: {
					notificationId: 1,
					data: { userId: "user-1", type: "FOLLOW_NEW", title: "t", body: "b" },
				},
			});

			expect(repository.markPushDispatchSkipped).toHaveBeenCalledWith(1, "NIGHT_PUSH_DISABLED");
		});

		it("실제 해외 타임존 유저는 자기 로컬 시간 기준으로 판정되어 KST로 오분류되지 않는다", async () => {
			jest.useFakeTimers().setSystemTime(KST_NIGHT_UTC_DAY);
			recipientPreferenceReader.getPreference.mockResolvedValue({
				...makePreference("user-1", "America/New_York"),
				nightPushEnabled: false,
			});
			rateLimiter.isRateLimited.mockResolvedValue(false);
			rateLimiter.isEngagementRateLimited.mockResolvedValue(false);
			activePushTokenReader.findByUserId.mockResolvedValue([]);
			repository.createPushDispatch.mockResolvedValue({ id: 1 });

			await useCase.execute({
				mode: "single",
				item: {
					notificationId: 1,
					data: { userId: "user-1", type: "FOLLOW_NEW", title: "t", body: "b" },
				},
			});

			expect(repository.markPushDispatchSkipped).toHaveBeenCalledWith(1, "NO_ACTIVE_TOKEN");
		});

		it("직교성: locale만 다른 두 유저(한국 tz)의 발송 자격은 동일하다 — 언어는 법적 게이트에 영향 없음", async () => {
			// 영어를 쓰는 한국 유저(locale=en, tz=Asia/Seoul)도 KST 야간 게이트가 동일 적용된다
			jest.useFakeTimers().setSystemTime(KST_NIGHT_UTC_DAY); // KST 23:00
			rateLimiter.isRateLimited.mockResolvedValue(false);

			recipientPreferenceReader.getPreference.mockResolvedValueOnce({
				...makePreference("u-ko", "Asia/Seoul"),
				locale: "ko",
				nightPushEnabled: false,
			});
			recipientPreferenceReader.getPreference.mockResolvedValueOnce({
				...makePreference("u-en", "Asia/Seoul"),
				locale: "en",
				nightPushEnabled: false,
			});
			repository.createPushDispatch
				.mockResolvedValueOnce({ id: 1 })
				.mockResolvedValueOnce({ id: 2 });

			await useCase.execute({
				mode: "single",
				item: {
					notificationId: 1,
					data: { userId: "u-ko", type: "FOLLOW_NEW", title: "t", body: "b" },
				},
			});
			await useCase.execute({
				mode: "single",
				item: {
					notificationId: 2,
					data: { userId: "u-en", type: "FOLLOW_NEW", title: "t", body: "b" },
				},
			});

			expect(repository.markPushDispatchSkipped).toHaveBeenNthCalledWith(
				1,
				1,
				"NIGHT_PUSH_DISABLED",
			);
			expect(repository.markPushDispatchSkipped).toHaveBeenNthCalledWith(
				2,
				2,
				"NIGHT_PUSH_DISABLED",
			);
		});
	});

	it("활성 토큰이 없으면 fireAndForgetPush는 조용히 종료한다", async () => {
		recipientPreferenceReader.getPreference.mockResolvedValue(
			makePreference("user-1", "Asia/Seoul"),
		);
		rateLimiter.isRateLimited.mockResolvedValue(false);
		activePushTokenReader.findByUserId.mockResolvedValue([]);
		repository.createPushDispatch.mockResolvedValue({ id: 1 });

		await useCase.execute({
			mode: "single",
			item: {
				data: { userId: "user-1", type: "NUDGE_RECEIVED", title: "t", body: "b" },
				notificationId: 1,
			},
		});

		expect(activePushTokenReader.findByUserId).toHaveBeenCalledWith("user-1");
	});

	it("단일 dispatch 생성 후 예상하지 못한 토큰 조회 오류는 FAILED로 전이한다", async () => {
		recipientPreferenceReader.getPreference.mockResolvedValue(
			makePreference("user-1", "Asia/Seoul"),
		);
		rateLimiter.isRateLimited.mockResolvedValue(false);
		repository.createPushDispatch.mockResolvedValue({ id: 101 });
		activePushTokenReader.findByUserId.mockRejectedValue(new Error("token storage unavailable"));

		await expect(
			useCase.execute({
				mode: "single",
				item: {
					data: { userId: "user-1", type: "FOLLOW_NEW", title: "t", body: "b" },
					notificationId: 1,
				},
			}),
		).rejects.toThrow("token storage unavailable");

		expect(repository.markPushDispatchFailed).toHaveBeenCalledWith(
			[101],
			"UNEXPECTED_DISPATCH_ERROR",
		);
	});

	it("단일 feature-discovery 발송도 지원 토큰이 없으면 capability skip으로 기록한다", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-07-16T03:00:00.000Z"));
		const tokenDate = new Date("2026-07-01T00:00:00.000Z");
		recipientPreferenceReader.getPreference.mockResolvedValue(
			makePreference("user-1", "Asia/Seoul"),
		);
		userSettings.getConsentRecord.mockResolvedValue(makeConsent("user-1"));
		rateLimiter.isRateLimited.mockResolvedValue(false);
		rateLimiter.isEngagementRateLimited.mockResolvedValue(false);
		repository.createPushDispatch.mockResolvedValue({ id: 2 });
		tokenRepository.findPushTokensByUser.mockResolvedValue([
			{
				id: 1,
				userId: "user-1",
				token: "ExponentPushToken[legacy-single]",
				deviceId: "legacy-single",
				platform: "IOS",
				isActive: true,
				createdAt: tokenDate,
				updatedAt: tokenDate,
				lastUsedAt: tokenDate,
				payloadVersion: 1,
				appVersion: "1.7.9",
			},
		]);

		await useCase.execute({
			mode: "single",
			item: {
				data: {
					userId: "user-1",
					type: "SYSTEM_NOTICE",
					purpose: "ENGAGEMENT",
					campaignKey: "feature-discovery-2026-08",
					title: "새 기능",
					body: "본문",
				},
				notificationId: 2,
			},
		});

		expect(repository.markPushDispatchSkipped).toHaveBeenCalledWith(
			2,
			"UNSUPPORTED_APP_CAPABILITY",
		);
		expect(pushProvider.sendBatch).not.toHaveBeenCalled();
	});

	it("배치 발송은 설정 필터 후 모든 사용자 제한을 한 번에 예약한다", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-07-16T00:00:00.000Z"));
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
			makePreference("user-1", "Asia/Seoul"),
			makePreference("user-2", "America/New_York"),
		]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([
			makeConsent("user-1"),
			makeConsent("user-2"),
		]);
		rateLimiter.reserveBatch.mockResolvedValue([true, true]);
		repository.createPushDispatch.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });

		await useCase.execute({
			mode: "batch",
			items: [
				{
					data: {
						userId: "user-1",
						type: "LUNCH_NUDGE",
						purpose: "ENGAGEMENT",
						title: "제목 1",
						body: "본문 1",
					},
					notificationId: 1,
				},
				{
					data: {
						userId: "user-2",
						type: "LUNCH_NUDGE",
						purpose: "ENGAGEMENT",
						title: "제목 2",
						body: "본문 2",
					},
					notificationId: 2,
				},
			],
		});

		expect(rateLimiter.reserveBatch).toHaveBeenCalledTimes(1);
		expect(rateLimiter.reserveBatch).toHaveBeenCalledWith([
			{ userId: "user-1", engagementLocalDate: "2026-07-16" },
			{ userId: "user-2", engagementLocalDate: "2026-07-15" },
		]);
		expect(repository.createPushDispatch).toHaveBeenCalledTimes(2);
		expect(repository.markPushDispatchSkipped).toHaveBeenCalledWith(1, "RATE_LIMITED");
		expect(repository.markPushDispatchSkipped).toHaveBeenCalledWith(2, "RATE_LIMITED");
	});

	it("배치 발송은 dispatch 생성과 스킵 상태를 각각 한 번의 저장소 호출로 기록한다", async () => {
		// Given
		const createPushDispatches = jest.fn().mockResolvedValue([
			{ id: 101, notificationId: 1 },
			{ id: 102, notificationId: 2 },
		]);
		const markPushDispatchesSkipped = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(repository, "createPushDispatches", {
			value: createPushDispatches,
		});
		Object.defineProperty(repository, "markPushDispatchesSkipped", {
			value: markPushDispatchesSkipped,
		});
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
			{ ...makePreference("user-1", "Asia/Seoul"), pushEnabled: false },
			{ ...makePreference("user-2", "Asia/Seoul"), pushEnabled: false },
		]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([
			makeConsent("user-1"),
			makeConsent("user-2"),
		]);
		repository.createPushDispatch
			.mockResolvedValueOnce({ id: 101 })
			.mockResolvedValueOnce({ id: 102 });

		// When
		await useCase.execute({
			mode: "batch",
			items: [
				{
					data: {
						userId: "user-1",
						type: "FOLLOW_NEW",
						title: "제목 1",
						body: "본문 1",
					},
					notificationId: 1,
				},
				{
					data: {
						userId: "user-2",
						type: "FOLLOW_NEW",
						title: "제목 2",
						body: "본문 2",
					},
					notificationId: 2,
				},
			],
		});

		// Then
		expect(createPushDispatches).toHaveBeenCalledTimes(1);
		expect(repository.createPushDispatch).not.toHaveBeenCalled();
		expect(markPushDispatchesSkipped).toHaveBeenCalledWith([
			{ dispatchId: 101, reason: "PUSH_DISABLED" },
			{ dispatchId: 102, reason: "PUSH_DISABLED" },
		]);
		expect(repository.markPushDispatchSkipped).not.toHaveBeenCalled();
	});

	it("배치 저장소가 일부 dispatch만 반환하면 생성된 ID를 FAILED로 전이한다", async () => {
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
			makePreference("user-1", "Asia/Seoul"),
			makePreference("user-2", "Asia/Seoul"),
		]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([
			makeConsent("user-1"),
			makeConsent("user-2"),
		]);
		repository.createPushDispatches.mockResolvedValue([{ id: 101, notificationId: 1 }]);
		repository.markPushDispatchFailed.mockResolvedValue(undefined);

		await expect(
			useCase.execute({
				mode: "batch",
				items: [
					{
						data: {
							userId: "user-1",
							type: "FOLLOW_NEW",
							title: "제목 1",
							body: "본문 1",
						},
						notificationId: 1,
					},
					{
						data: {
							userId: "user-2",
							type: "FOLLOW_NEW",
							title: "제목 2",
							body: "본문 2",
						},
						notificationId: 2,
					},
				],
			}),
		).rejects.toThrow("Push dispatch batch result missing: notificationId=2");

		expect(repository.markPushDispatchFailed).toHaveBeenCalledWith(
			[101],
			"UNEXPECTED_DISPATCH_ERROR",
		);
		expect(rateLimiter.reserveBatch).not.toHaveBeenCalled();
	});

	it("배치 발송 결과는 모든 dispatch를 한 번의 저장소 호출로 기록한다", async () => {
		// Given
		const createPushDispatches = jest.fn().mockResolvedValue([
			{ id: 201, notificationId: 11 },
			{ id: 202, notificationId: 12 },
		]);
		const recordPushDeliveryResultsBatch = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(repository, "createPushDispatches", {
			value: createPushDispatches,
		});
		Object.defineProperty(repository, "recordPushDeliveryResultsBatch", {
			value: recordPushDeliveryResultsBatch,
		});
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
			makePreference("user-1", "Asia/Seoul"),
			makePreference("user-2", "Asia/Seoul"),
		]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([
			makeConsent("user-1"),
			makeConsent("user-2"),
		]);
		rateLimiter.reserveBatch.mockResolvedValue([false, false]);
		repository.createPushDispatch
			.mockResolvedValueOnce({ id: 201 })
			.mockResolvedValueOnce({ id: 202 });
		activePushTokenReader.findByUserIds.mockResolvedValue(
			new Map([
				["user-1", ["ExponentPushToken[user-1]"]],
				["user-2", ["ExponentPushToken[user-2]"]],
			]),
		);
		pushProvider.sendBatch.mockResolvedValue({
			total: 2,
			successCount: 2,
			failureCount: 0,
			results: [
				{
					token: "ExponentPushToken[user-1]",
					success: true,
					ticketId: "ticket-1",
				},
				{
					token: "ExponentPushToken[user-2]",
					success: true,
					ticketId: "ticket-2",
				},
			],
			invalidTokens: [],
		});
		repository.recordPushDeliveryResults.mockResolvedValue(undefined);

		// When
		await useCase.execute({
			mode: "batch",
			items: [
				{
					data: {
						userId: "user-1",
						type: "FOLLOW_NEW",
						title: "제목 1",
						body: "본문 1",
					},
					notificationId: 11,
				},
				{
					data: {
						userId: "user-2",
						type: "FOLLOW_NEW",
						title: "제목 2",
						body: "본문 2",
					},
					notificationId: 12,
				},
			],
		});

		// Then
		expect(recordPushDeliveryResultsBatch).toHaveBeenCalledTimes(1);
		expect(recordPushDeliveryResultsBatch).toHaveBeenCalledWith([
			{
				dispatchId: 201,
				results: [
					expect.objectContaining({
						token: "ExponentPushToken[user-1]",
						success: true,
					}),
				],
			},
			{
				dispatchId: 202,
				results: [
					expect.objectContaining({
						token: "ExponentPushToken[user-2]",
						success: true,
					}),
				],
			},
		]);
		expect(repository.recordPushDeliveryResults).not.toHaveBeenCalled();
	});

	it("배치 dispatch 생성 후 예상하지 못한 rate limiter 오류는 모든 PROCESSING dispatch를 FAILED로 전이한다", async () => {
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
			makePreference("user-1", "Asia/Seoul"),
			makePreference("user-2", "Asia/Seoul"),
		]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([
			makeConsent("user-1"),
			makeConsent("user-2"),
		]);
		repository.createPushDispatch
			.mockResolvedValueOnce({ id: 201 })
			.mockResolvedValueOnce({ id: 202 });
		rateLimiter.reserveBatch.mockRejectedValue(new Error("rate limiter unavailable"));

		await expect(
			useCase.execute({
				mode: "batch",
				items: [
					{
						data: {
							userId: "user-1",
							type: "FOLLOW_NEW",
							title: "t1",
							body: "b1",
						},
						notificationId: 1,
					},
					{
						data: {
							userId: "user-2",
							type: "FOLLOW_NEW",
							title: "t2",
							body: "b2",
						},
						notificationId: 2,
					},
				],
			}),
		).rejects.toThrow("rate limiter unavailable");

		expect(repository.markPushDispatchFailed).toHaveBeenCalledWith(
			[201, 202],
			"UNEXPECTED_DISPATCH_ERROR",
		);
	});

	it("푸시 설정 비활성은 dispatch를 PUSH_DISABLED로 스킵 기록한다", async () => {
		const markPushDispatchSkipped = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(repository, "markPushDispatchSkipped", {
			value: markPushDispatchSkipped,
		});
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
			{ ...makePreference("user-1", "Asia/Seoul"), pushEnabled: false },
		]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([makeConsent("user-1")]);
		repository.createPushDispatch.mockResolvedValue({ id: 41 });

		await useCase.execute({
			mode: "batch",
			items: [
				{
					data: {
						userId: "user-1",
						type: "FOLLOW_NEW",
						title: "제목",
						body: "본문",
					},
					notificationId: 1,
				},
			],
		});

		expect(repository.createPushDispatch).toHaveBeenCalledTimes(1);
		expect(markPushDispatchSkipped).toHaveBeenCalledWith(41, "PUSH_DISABLED");
		expect(pushProvider.sendBatch).not.toHaveBeenCalled();
	});

	it("마케팅 동의 부재는 dispatch를 MARKETING_CONSENT_REQUIRED로 스킵 기록한다", async () => {
		jest.useFakeTimers().setSystemTime(KST_MARKETING_DAYTIME);
		const markPushDispatchSkipped = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(repository, "markPushDispatchSkipped", {
			value: markPushDispatchSkipped,
		});
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
			makePreference("user-1", "Asia/Seoul"),
		]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([]);
		repository.createPushDispatch.mockResolvedValue({ id: 42 });

		await useCase.execute({
			mode: "batch",
			items: [
				{
					data: {
						userId: "user-1",
						type: "LUNCH_NUDGE",
						purpose: "ENGAGEMENT",
						title: "제목",
						body: "본문",
					},
					notificationId: 2,
				},
			],
		});

		expect(markPushDispatchSkipped).toHaveBeenCalledWith(42, "MARKETING_CONSENT_REQUIRED");
		expect(pushProvider.sendBatch).not.toHaveBeenCalled();
	});

	it("활성 토큰 부재는 dispatch를 NO_ACTIVE_TOKEN으로 스킵 기록한다", async () => {
		const markPushDispatchSkipped = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(repository, "markPushDispatchSkipped", {
			value: markPushDispatchSkipped,
		});
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
			makePreference("user-1", "Asia/Seoul"),
		]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([makeConsent("user-1")]);
		rateLimiter.reserveBatch.mockResolvedValue([false]);
		repository.createPushDispatch.mockResolvedValue({ id: 43 });
		await useCase.execute({
			mode: "batch",
			items: [
				{
					data: {
						userId: "user-1",
						type: "FOLLOW_NEW",
						title: "제목",
						body: "본문",
					},
					notificationId: 3,
				},
			],
		});

		expect(markPushDispatchSkipped).toHaveBeenCalledWith(43, "NO_ACTIVE_TOKEN");
		expect(repository.recordPushDeliveryResults).not.toHaveBeenCalled();
	});

	it("feature-discovery 마케팅은 payload v2와 app 1.8.0 이상 토큰만 발송한다", async () => {
		jest.useFakeTimers().setSystemTime(KST_MARKETING_DAYTIME);
		const markPushDispatchSkipped = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(repository, "markPushDispatchSkipped", {
			value: markPushDispatchSkipped,
		});
		const createdAt = new Date("2026-07-01T00:00:00.000Z");
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
			makePreference("user-1", "Asia/Seoul"),
		]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([makeConsent("user-1")]);
		rateLimiter.reserveBatch.mockResolvedValue([false]);
		repository.createPushDispatch.mockResolvedValue({ id: 44 });
		tokenRepository.findActivePushTokensByUsers.mockResolvedValue([
			{
				id: 1,
				userId: "user-1",
				token: "ExponentPushToken[payload-v1]",
				deviceId: "device-v1",
				platform: "IOS",
				isActive: true,
				createdAt,
				updatedAt: createdAt,
				lastUsedAt: createdAt,
				payloadVersion: 1,
				appVersion: "1.9.0",
			},
			{
				id: 2,
				userId: "user-1",
				token: "ExponentPushToken[old-app]",
				deviceId: "device-old-app",
				platform: "IOS",
				isActive: true,
				createdAt,
				updatedAt: createdAt,
				lastUsedAt: createdAt,
				payloadVersion: 2,
				appVersion: "1.7.9",
			},
			{
				id: 3,
				userId: "user-1",
				token: "ExponentPushToken[capable]",
				deviceId: "device-capable",
				platform: "IOS",
				isActive: true,
				createdAt,
				updatedAt: createdAt,
				lastUsedAt: createdAt,
				payloadVersion: 2,
				appVersion: "1.8.0",
			},
		]);
		pushProvider.sendBatch.mockResolvedValue({
			total: 1,
			successCount: 1,
			failureCount: 0,
			results: [
				{
					token: "ExponentPushToken[capable]",
					success: true,
					ticketId: "ticket-capable",
				},
			],
			invalidTokens: [],
		});
		repository.recordPushDeliveryResults.mockResolvedValue(undefined);

		await useCase.execute({
			mode: "batch",
			items: [
				{
					data: {
						userId: "user-1",
						type: "SYSTEM_NOTICE",
						purpose: "ENGAGEMENT",
						campaignKey: "feature-discovery-2026-08",
						title: "새 기능",
						body: "새 기능을 확인해보세요",
					},
					notificationId: 4,
				},
			],
		});

		expect(pushProvider.sendBatch).toHaveBeenCalledWith([
			expect.objectContaining({ token: "ExponentPushToken[capable]" }),
		]);
		expect(markPushDispatchSkipped).not.toHaveBeenCalled();
	});

	it("feature-discovery 마케팅에 지원 토큰이 없으면 UNSUPPORTED_APP_CAPABILITY로 스킵한다", async () => {
		jest.useFakeTimers().setSystemTime(KST_MARKETING_DAYTIME);
		const markPushDispatchSkipped = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(repository, "markPushDispatchSkipped", {
			value: markPushDispatchSkipped,
		});
		const createdAt = new Date("2026-07-01T00:00:00.000Z");
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
			makePreference("user-1", "Asia/Seoul"),
		]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([makeConsent("user-1")]);
		rateLimiter.reserveBatch.mockResolvedValue([false]);
		repository.createPushDispatch.mockResolvedValue({ id: 45 });
		tokenRepository.findActivePushTokensByUsers.mockResolvedValue([
			{
				id: 1,
				userId: "user-1",
				token: "ExponentPushToken[legacy]",
				deviceId: "legacy-device",
				platform: "IOS",
				isActive: true,
				createdAt,
				updatedAt: createdAt,
				lastUsedAt: createdAt,
				payloadVersion: 1,
				appVersion: null,
			},
		]);

		await useCase.execute({
			mode: "batch",
			items: [
				{
					data: {
						userId: "user-1",
						type: "SYSTEM_NOTICE",
						purpose: "ENGAGEMENT",
						campaignKey: "feature-discovery-2026-08",
						title: "새 기능",
						body: "새 기능을 확인해보세요",
					},
					notificationId: 5,
				},
			],
		});

		expect(markPushDispatchSkipped).toHaveBeenCalledWith(45, "UNSUPPORTED_APP_CAPABILITY");
		expect(pushProvider.sendBatch).not.toHaveBeenCalled();
	});

	it("force 항목은 설정 행이 없어도 발송 자격을 얻고, 일반 항목은 기존대로 차단된다", async () => {
		// Given - 두 사용자 모두 preference 행이 없을 때(기본 거부), user-1만 force
		const token = "ExponentPushToken[force-user]";
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([]);
		rateLimiter.reserveBatch.mockResolvedValue([false]);
		repository.createPushDispatch
			.mockResolvedValueOnce({ id: 9 })
			.mockResolvedValueOnce({ id: 10 });
		repository.recordPushDeliveryResults.mockResolvedValue(undefined);
		activePushTokenReader.findByUserIds.mockResolvedValue(new Map([["user-1", [token]]]));
		pushProvider.sendBatch.mockResolvedValue({
			total: 1,
			successCount: 1,
			failureCount: 0,
			results: [{ token, success: true, ticketId: "ticket-force" }],
			invalidTokens: [],
		});

		// When - force 항목과 일반 항목을 함께 배치 발송하면
		await useCase.execute({
			mode: "batch",
			items: [
				{
					data: {
						userId: "user-1",
						type: "ADMIN_BROADCAST",
						title: "중요 공지",
						body: "강제 발송 본문",
						force: true,
					},
					notificationId: 11,
				},
				{
					data: {
						userId: "user-2",
						type: "ADMIN_BROADCAST",
						title: "중요 공지",
						body: "강제 발송 본문",
					},
					notificationId: 12,
				},
			],
		});

		// Then - force 항목만 설정 게이트를 우회해 rate limit 예약과 실제 발송에 도달한다
		expect(rateLimiter.reserveBatch).toHaveBeenCalledWith([{ userId: "user-1" }]);
		expect(repository.createPushDispatch).toHaveBeenCalledTimes(2);
		expect(repository.createPushDispatch).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "user-1", notificationId: 11 }),
		);
		expect(repository.markPushDispatchSkipped).toHaveBeenCalledWith(10, "PUSH_SETTINGS_MISSING");
		expect(pushProvider.sendBatch).toHaveBeenCalledTimes(1);
	});

	it("댓글 routing을 추가해도 v1.8.2와 현재 payload 계약을 모두 만족한다", async () => {
		const token = "ExponentPushToken[legacy-compatible]";
		recipientPreferenceReader.getPreference.mockResolvedValue(
			makePreference("user-1", "Asia/Seoul"),
		);
		activePushTokenReader.findByUserId.mockResolvedValue([token]);
		repository.createPushDispatch.mockResolvedValue({ id: 77 });
		repository.recordPushDeliveryResults.mockResolvedValue(undefined);
		pushProvider.sendBatch.mockResolvedValue({
			total: 1,
			successCount: 1,
			failureCount: 0,
			results: [{ token, success: true, ticketId: "ticket-1" }],
			invalidTokens: [],
		});

		await useCase.execute({
			mode: "single",
			item: {
				data: {
					userId: "user-1",
					type: "TODO_SHARED",
					title: "새 댓글",
					body: "할 일에 댓글이 달렸어요",
					todoId: 42,
					metadata: {
						commentId: "cmt92zn3n000b7voxx9quc2th",
						threadRootId: "cmt92zn3n000b7voxx9quc2th",
						activityKind: "COMMENT",
					},
					campaignKey: "todo_reminder_v2",
					variantId: "todo_reminder_v2.60min.v2",
				},
				notificationId: 101,
			},
		});

		const data = pushProvider.sendBatch.mock.calls[0]?.[0]?.[0]?.data;
		expect(LEGACY_PUSH_DATA_SCHEMAS.V1_0_TO_V1_1.safeParse(data).success).toBe(true);
		const version182Payload = LEGACY_PUSH_DATA_SCHEMAS.V1_2_TO_V1_8_2.safeParse(data);
		expect(version182Payload.success).toBe(true);
		expect(pushNotificationDataSchema.safeParse(data).success).toBe(true);
		if (!version182Payload.success) {
			throw version182Payload.error;
		}
		expect(version182Payload.data).not.toHaveProperty("routing");
		expect(data).toMatchObject({
			notificationId: 101,
			type: "TODO_SHARED",
			action: { type: "DEEP_LINK" },
			context: { todoId: 42 },
			routing: {
				commentId: "cmt92zn3n000b7voxx9quc2th",
				threadRootId: "cmt92zn3n000b7voxx9quc2th",
				activityKind: "COMMENT",
			},
			dispatchId: 77,
			campaignKey: "todo_reminder_v2",
			variantId: "todo_reminder_v2.60min.v2",
		});
	});
});
