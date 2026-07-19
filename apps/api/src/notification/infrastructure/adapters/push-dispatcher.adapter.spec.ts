/**
 * PushDispatcherAdapter 단위 테스트 (자격 판단 경로)
 *
 * 발송 자격 판단은 preference 캐시(cache-aside)를 경유한다. 여기서는 결정적인
 * 기본값 경로(설정 미존재 → USER_PREFERENCE_DEFAULTS)를 검증한다.
 * 실제 푸시 전송·happy path는 notification.integration-spec이 end-to-end로 커버한다.
 */
import { pushNotificationDataSchema } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { z } from "zod";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import type {
	UserConsentRecordWithId,
	UserPreferenceRecordWithId,
} from "@/user-settings";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../application/ports/notification.repository.port";
import {
	PUSH_PROVIDER,
	type PushProvider,
} from "../../application/ports/push-provider.port";
import {
	type IPushRateLimiter,
	PUSH_RATE_LIMITER,
} from "../../application/ports/push-rate-limiter.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../../application/ports/user-notification-settings.port";
import { PushDispatcherAdapter } from "./push-dispatcher.adapter";

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

/** v1.2.0~v1.4.x에서 위 enum에 추가된 날씨 알림 타입. */
const LEGACY_V1_2_NOTIFICATION_TYPES = [
	...LEGACY_V1_0_NOTIFICATION_TYPES,
	"WEATHER_MORNING",
	"WEATHER_EVENING",
] as const;

function legacyPushDataSchema(
	notificationTypes: readonly [string, ...string[]],
) {
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
	V1_2_TO_V1_4: legacyPushDataSchema(LEGACY_V1_2_NOTIFICATION_TYPES),
} as const;

function makePreference(
	userId: string,
	timezone: string,
): UserPreferenceRecordWithId {
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

function createDeferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
} {
	let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
	const promise = new Promise<T>((resolver) => {
		resolve = resolver;
	});
	return { promise, resolve };
}

describe("PushDispatcherAdapter", () => {
	let adapter: PushDispatcherAdapter;
	let userSettings: Mocked<UserNotificationSettingsPort>;
	let rateLimiter: Mocked<IPushRateLimiter>;
	let cacheService: Mocked<CacheService>;
	let repository: Mocked<NotificationRepositoryPort>;
	let pushProvider: Mocked<PushProvider>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			PushDispatcherAdapter,
		).compile();
		adapter = unit;
		userSettings = unitRef.get(USER_NOTIFICATION_SETTINGS);
		rateLimiter = unitRef.get(PUSH_RATE_LIMITER);
		cacheService = unitRef.get(CacheService);
		repository = unitRef.get(NOTIFICATION_REPOSITORY);
		pushProvider = unitRef.get(PUSH_PROVIDER);

		// cache-aside: 캐시 미스 시 콜백을 실행하도록 passthrough
		cacheService.wrapUserPreference.mockImplementation((_userId, fn) => fn());
	});

	afterEach(() => jest.useRealTimers());

	it("설정 미존재(기본값 pushEnabled=false)면 발송하지 않고 rate limit도 조회하지 않는다", async () => {
		userSettings.getPreferenceRecord.mockResolvedValue(null);

		const result = await adapter.shouldSendPush("user-1", "NUDGE_RECEIVED");

		expect(result).toBe(false);
		// pushEnabled 게이트가 먼저이므로 rate limit 조회 없음
		expect(rateLimiter.isRateLimited).not.toHaveBeenCalled();
	});

	it("설정 미존재면 기본 로케일(ko)을 반환한다", async () => {
		userSettings.getPreferenceRecord.mockResolvedValue(null);

		const locale = await adapter.getUserLocale("user-1");

		expect(locale).toBe("ko");
	});

	it("활성 토큰이 없으면 fireAndForgetPush는 조용히 종료한다", async () => {
		cacheService.wrapPushTokens.mockImplementation((_userId, fn) => fn());
		repository.findPushTokensByUser.mockResolvedValue([]);
		repository.createPushDispatch.mockResolvedValue({ id: 1 });

		adapter.fireAndForgetPush(
			{ userId: "user-1", type: "NUDGE_RECEIVED", title: "t", body: "b" },
			1,
		);
		await adapter.beforeApplicationShutdown();

		expect(repository.findPushTokensByUser).toHaveBeenCalledWith({
			userId: "user-1",
			activeOnly: true,
		});
	});

	it("drain 도중 추가된 push까지 모두 완료될 때까지 기다린다", async () => {
		const releaseSecondPush = createDeferred<void>();
		const secondPushStarted = createDeferred<void>();
		userSettings.getPreferenceRecord.mockImplementation(async (userId) =>
			makePreference(userId, "UTC"),
		);
		rateLimiter.isRateLimited.mockResolvedValue(false);
		cacheService.wrapPushTokens.mockResolvedValue([]);
		repository.recordPushDeliveryResults.mockResolvedValue(undefined);
		repository.createPushDispatch.mockImplementation(async ({ userId }) => {
			if (userId === "user-1") {
				adapter.fireAndForgetPush(
					{
						userId: "user-2",
						type: "NUDGE_RECEIVED",
						title: "second",
						body: "second",
					},
					2,
				);
				return { id: 1 };
			}

			secondPushStarted.resolve(undefined);
			await releaseSecondPush.promise;
			return { id: 2 };
		});

		adapter.fireAndForgetPush(
			{
				userId: "user-1",
				type: "NUDGE_RECEIVED",
				title: "first",
				body: "first",
			},
			1,
		);
		const draining = adapter.drainPendingPushes();
		await secondPushStarted.promise;

		const drainState = await Promise.race([
			draining.then(() => "completed" as const),
			new Promise<"pending">((resolve) => {
				setImmediate(() => resolve("pending"));
			}),
		]);
		expect(drainState).toBe("pending");

		releaseSecondPush.resolve(undefined);
		await draining;
		expect(repository.recordPushDeliveryResults).toHaveBeenCalledTimes(2);
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

		adapter.fireAndForgetBatchPush([
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
		]);
		await adapter.beforeApplicationShutdown();

		expect(rateLimiter.reserveBatch).toHaveBeenCalledTimes(1);
		expect(rateLimiter.reserveBatch).toHaveBeenCalledWith([
			{ userId: "user-1", engagementLocalDate: "2026-07-16" },
			{ userId: "user-2", engagementLocalDate: "2026-07-15" },
		]);
		expect(repository.createPushDispatch).not.toHaveBeenCalled();
	});

	it("force 항목은 설정 행이 없어도 발송 자격을 얻고, 일반 항목은 기존대로 차단된다", async () => {
		// Given - 두 사용자 모두 preference 행이 없을 때(기본 거부), user-1만 force
		const token = "ExponentPushToken[force-user]";
		const tokenDate = new Date("2026-07-01T00:00:00.000Z");
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([]);
		userSettings.getConsentRecordsByUserIds.mockResolvedValue([]);
		rateLimiter.reserveBatch.mockResolvedValue([false]);
		repository.createPushDispatch.mockResolvedValue({ id: 9 });
		repository.recordPushDeliveryResults.mockResolvedValue(undefined);
		cacheService.mget.mockResolvedValue([undefined]);
		cacheService.mset.mockResolvedValue(undefined);
		repository.findActivePushTokensByUsers.mockResolvedValue([
			{
				id: 1,
				userId: "user-1",
				token,
				deviceId: "force-device",
				platform: "IOS",
				isActive: true,
				createdAt: tokenDate,
				updatedAt: tokenDate,
				lastUsedAt: tokenDate,
				payloadVersion: 2,
				appVersion: "1.6.0",
			},
		]);
		pushProvider.sendBatch.mockResolvedValue({
			total: 1,
			successCount: 1,
			failureCount: 0,
			results: [{ token, success: true, ticketId: "ticket-force" }],
			invalidTokens: [],
		});

		// When - force 항목과 일반 항목을 함께 배치 발송하면
		adapter.fireAndForgetBatchPush([
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
		]);
		await adapter.beforeApplicationShutdown();

		// Then - force 항목만 설정 게이트를 우회해 rate limit 예약과 실제 발송에 도달한다
		expect(rateLimiter.reserveBatch).toHaveBeenCalledWith([
			{ userId: "user-1" },
		]);
		expect(repository.createPushDispatch).toHaveBeenCalledTimes(1);
		expect(repository.createPushDispatch).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "user-1", notificationId: 11 }),
		);
		expect(pushProvider.sendBatch).toHaveBeenCalledTimes(1);
	});

	it("추가 분석 필드가 있어도 v1.0~v1.4와 현재 클라이언트 payload 계약을 모두 만족한다", async () => {
		const token = "ExponentPushToken[legacy-compatible]";
		userSettings.getPreferenceRecord.mockResolvedValue(
			makePreference("user-1", "Asia/Seoul"),
		);
		cacheService.wrapPushTokens.mockImplementation((_userId, fn) => fn());
		const tokenDate = new Date("2026-07-01T00:00:00.000Z");
		repository.findPushTokensByUser.mockResolvedValue([
			{
				id: 1,
				userId: "user-1",
				token,
				deviceId: "legacy-device",
				platform: "IOS",
				isActive: true,
				createdAt: tokenDate,
				updatedAt: tokenDate,
				lastUsedAt: tokenDate,
				payloadVersion: 1,
				appVersion: "1.0.0",
			},
		]);
		repository.createPushDispatch.mockResolvedValue({ id: 77 });
		repository.recordPushDeliveryResults.mockResolvedValue(undefined);
		pushProvider.sendBatch.mockResolvedValue({
			total: 1,
			successCount: 1,
			failureCount: 0,
			results: [{ token, success: true, ticketId: "ticket-1" }],
			invalidTokens: [],
		});

		adapter.fireAndForgetPush(
			{
				userId: "user-1",
				type: "TODO_REMINDER",
				title: "할 일 시간이야",
				body: "가볍게 시작해보자",
				todoId: 42,
				campaignKey: "todo_reminder_v2",
				variantId: "todo_reminder_v2.60min.v2",
			},
			101,
		);
		await adapter.beforeApplicationShutdown();

		const data = pushProvider.sendBatch.mock.calls[0]?.[0]?.[0]?.data;
		expect(LEGACY_PUSH_DATA_SCHEMAS.V1_0_TO_V1_1.safeParse(data).success).toBe(
			true,
		);
		expect(LEGACY_PUSH_DATA_SCHEMAS.V1_2_TO_V1_4.safeParse(data).success).toBe(
			true,
		);
		expect(pushNotificationDataSchema.safeParse(data).success).toBe(true);
		expect(data).toMatchObject({
			notificationId: 101,
			type: "TODO_REMINDER",
			action: { type: "DEEP_LINK" },
			context: { todoId: 42 },
			dispatchId: 77,
			campaignKey: "todo_reminder_v2",
			variantId: "todo_reminder_v2.60min.v2",
		});
	});
});
