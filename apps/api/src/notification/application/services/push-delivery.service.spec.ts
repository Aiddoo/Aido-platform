/**
 * PushDeliveryService 단위 테스트 (Suites + GWT 패턴)
 *
 * 푸시 토큰 관리, 발송 필터링, fire-and-forget 발송, graceful shutdown 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { PushTokenBuilder, UserPreferenceBuilder } from "@test/builders";
import type { PushToken } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";

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
import { PushDeliveryService } from "./push-delivery.service";

// isNightTime을 제어 가능하게 mock (dayjs 시간 경계를 결정론적으로 통제)
jest.mock("../../domain/services/night-time", () => ({
	isNightTime: jest.fn(() => false),
}));

import { isNightTime } from "../../domain/services/night-time";

const mockedIsNightTime = jest.mocked(isNightTime);

describe("PushDeliveryService — 푸시 전송 서비스", () => {
	let service: PushDeliveryService;
	let notificationRepository: Mocked<NotificationRepositoryPort>;
	let pushProvider: Mocked<PushProvider>;
	let userSettings: Mocked<UserNotificationSettingsPort>;
	let cacheService: Mocked<CacheService>;

	beforeEach(async () => {
		PushTokenBuilder.resetIdCounter();

		const mockPushProvider: PushProvider = {
			name: "mock",
			send: jest.fn(),
			sendBatch: jest.fn(),
			validateToken: jest.fn(),
		};

		// 실제 슬라이딩 윈도우 동작을 재현하는 rate limiter mock
		const rateLimitCounts = new Map<string, number>();
		const mockRateLimiter: IPushRateLimiter = {
			isRateLimited: jest.fn(async (userId: string) => {
				const count = rateLimitCounts.get(userId) ?? 0;
				if (count >= 15) return true;
				rateLimitCounts.set(userId, count + 1);
				return false;
			}),
		};

		const { unit, unitRef } = await TestBed.solitary(PushDeliveryService)
			.mock(PUSH_PROVIDER)
			.impl(() => mockPushProvider)
			.mock(PUSH_RATE_LIMITER)
			.impl(() => mockRateLimiter)
			.compile();

		service = unit;
		notificationRepository = unitRef.get(NOTIFICATION_REPOSITORY);
		pushProvider = unitRef.get(PUSH_PROVIDER);
		userSettings = unitRef.get(USER_NOTIFICATION_SETTINGS);
		cacheService = unitRef.get(CacheService);

		// 캐시 기본 동작: pass-through (캐시 미스 시뮬레이션)
		cacheService.wrapPushTokens.mockImplementation((_userId, factory) =>
			factory(),
		);
		cacheService.wrapUserPreference.mockImplementation((_userId, factory) =>
			factory(),
		);
		cacheService.mget.mockImplementation(async (keys: string[]) =>
			keys.map(() => undefined),
		);

		// 기본 mock 설정
		mockedIsNightTime.mockReturnValue(false);
	});

	describe("registerPushToken", () => {
		it("유효한 토큰을 등록하고 timezone을 upsert한다", async () => {
			// Given
			const data = {
				userId: "user-1",
				token: "ExponentPushToken[valid]",
				deviceId: "device-1",
				timezone: "Asia/Seoul",
			};
			const expectedToken = PushTokenBuilder.create("user-1")
				.withToken(data.token)
				.build();
			pushProvider.validateToken.mockReturnValue(true);
			notificationRepository.registerPushToken.mockResolvedValue(expectedToken);

			// When
			const result = await service.registerPushToken(data);

			// Then
			expect(pushProvider.validateToken).toHaveBeenCalledWith(data.token);
			expect(notificationRepository.registerPushToken).toHaveBeenCalledWith(
				data,
			);
			expect(userSettings.upsertPushTimezone).toHaveBeenCalledWith(
				"user-1",
				"Asia/Seoul",
			);
			expect(cacheService.invalidatePushTokens).toHaveBeenCalledWith("user-1");
			expect(cacheService.invalidateUserPreference).toHaveBeenCalledWith(
				"user-1",
			);
			expect(result).toEqual(expectedToken);
		});

		it("locale이 있으면 UserPreference에 upsert한다", async () => {
			// Given
			const data = {
				userId: "user-1",
				token: "ExponentPushToken[valid]",
				deviceId: "device-1",
				locale: "en",
			};
			const expectedToken = PushTokenBuilder.create("user-1").build();
			pushProvider.validateToken.mockReturnValue(true);
			notificationRepository.registerPushToken.mockResolvedValue(expectedToken);

			// When
			await service.registerPushToken(data);

			// Then
			expect(userSettings.upsertPushLocale).toHaveBeenCalledWith(
				"user-1",
				"en",
			);
			expect(userSettings.upsertPushTimezone).not.toHaveBeenCalled();
			expect(cacheService.invalidateUserPreference).toHaveBeenCalledWith(
				"user-1",
			);
		});

		it("timezone이 없으면 upsert하지 않는다", async () => {
			// Given
			const data = {
				userId: "user-1",
				token: "ExponentPushToken[valid]",
				deviceId: "device-1",
			};
			const expectedToken = PushTokenBuilder.create("user-1").build();
			pushProvider.validateToken.mockReturnValue(true);
			notificationRepository.registerPushToken.mockResolvedValue(expectedToken);

			// When
			await service.registerPushToken(data);

			// Then
			expect(userSettings.upsertPushTimezone).not.toHaveBeenCalled();
			expect(userSettings.upsertPushLocale).not.toHaveBeenCalled();
			expect(cacheService.invalidatePushTokens).toHaveBeenCalledWith("user-1");
			expect(cacheService.invalidateUserPreference).not.toHaveBeenCalled();
		});

		it("유효하지 않은 토큰이면 BusinessException을 던진다", async () => {
			// Given
			pushProvider.validateToken.mockReturnValue(false);

			// When / Then
			await expect(
				service.registerPushToken({
					userId: "user-1",
					token: "invalid-token",
				}),
			).rejects.toThrow(ApplicationException);
			expect(notificationRepository.registerPushToken).not.toHaveBeenCalled();
		});
	});

	describe("unregisterPushToken", () => {
		it("토큰을 삭제한다", async () => {
			// Given
			const token = PushTokenBuilder.create("user-1").build();
			notificationRepository.deletePushToken.mockResolvedValue(token);

			// When
			await service.unregisterPushToken("user-1", "device-1");

			// Then
			expect(notificationRepository.deletePushToken).toHaveBeenCalledWith(
				"user-1",
				"device-1",
			);
			expect(cacheService.invalidatePushTokens).toHaveBeenCalledWith("user-1");
		});

		it("존재하지 않는 토큰(P2025)이면 조용히 무시한다", async () => {
			// Given
			notificationRepository.deletePushToken.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Not found", {
					code: "P2025",
					meta: {},
					clientVersion: "7.0.0",
				}),
			);

			// When / Then
			await expect(
				service.unregisterPushToken("user-1", "device-1"),
			).resolves.not.toThrow();
		});
	});

	describe("unregisterAllPushTokens", () => {
		it("사용자의 모든 토큰을 삭제한다", async () => {
			// Given
			notificationRepository.deleteAllPushTokensByUser.mockResolvedValue({
				count: 2,
			});

			// When
			await service.unregisterAllPushTokens("user-1");

			// Then
			expect(
				notificationRepository.deleteAllPushTokensByUser,
			).toHaveBeenCalledWith("user-1");
			expect(cacheService.invalidatePushTokens).toHaveBeenCalledWith("user-1");
		});
	});

	describe("shouldSendPush", () => {
		it("preference가 없으면 false를 반환한다", async () => {
			// Given
			userSettings.getPreferenceRecord.mockResolvedValue(null);

			// When
			const result = await service.shouldSendPush("user-1", "FOLLOW_NEW");

			// Then
			expect(result).toBe(false);
		});

		it("pushEnabled가 false면 false를 반환한다", async () => {
			// Given
			userSettings.getPreferenceRecord.mockResolvedValue(
				UserPreferenceBuilder.create("user-1").withPushDisabled().build(),
			);

			// When
			const result = await service.shouldSendPush("user-1", "FOLLOW_NEW");

			// Then
			expect(result).toBe(false);
		});

		it("야간 시간에 nightPushEnabled가 false면 false를 반환한다 (면제 타입 제외)", async () => {
			// Given
			userSettings.getPreferenceRecord.mockResolvedValue(
				UserPreferenceBuilder.create("user-1")
					.withTimezone("Asia/Seoul")
					.build(),
			);
			mockedIsNightTime.mockReturnValue(true);

			// When — CHEER_RECEIVED는 야간 면제 타입이 아님
			const result = await service.shouldSendPush("user-1", "CHEER_RECEIVED");

			// Then
			expect(result).toBe(false);
		});

		it("모든 조건 통과 시 true를 반환한다", async () => {
			// Given
			userSettings.getPreferenceRecord.mockResolvedValue(
				UserPreferenceBuilder.create("user-1")
					.withNightPushEnabled(true)
					.withTimezone("Asia/Seoul")
					.build(),
			);

			// When
			const result = await service.shouldSendPush("user-1", "FOLLOW_NEW");

			// Then
			expect(result).toBe(true);
		});

		it("야간이지만 WEATHER_MORNING은 nightPushEnabled=false여도 발송한다", async () => {
			// Given — 사용자가 직접 선택한 아침 시간이므로 야간 면제 필수
			userSettings.getPreferenceRecord.mockResolvedValue(
				UserPreferenceBuilder.create("user-1")
					.withTimezone("Asia/Seoul")
					.build(),
			);
			mockedIsNightTime.mockReturnValue(true);

			// When
			const result = await service.shouldSendPush("user-1", "WEATHER_MORNING");

			// Then
			expect(result).toBe(true);
		});

		it("1시간 내 15건 초과 시 rate limit으로 false를 반환한다", async () => {
			// Given
			userSettings.getPreferenceRecord.mockResolvedValue(
				UserPreferenceBuilder.create("user-rate")
					.withNightPushEnabled(true)
					.build(),
			);

			// When — 15건 발송 (모두 true)
			for (let i = 0; i < 15; i++) {
				const result = await service.shouldSendPush(
					"user-rate",
					"CHEER_RECEIVED",
				);
				expect(result).toBe(true);
			}

			// Then — 16번째는 rate limit
			const result = await service.shouldSendPush(
				"user-rate",
				"CHEER_RECEIVED",
			);
			expect(result).toBe(false);
		});

		it("다른 사용자의 rate limit은 독립적이다", async () => {
			// Given
			userSettings.getPreferenceRecord.mockResolvedValue(
				UserPreferenceBuilder.create("user-a")
					.withNightPushEnabled(true)
					.build(),
			);

			// When — user-a 15건 소진
			for (let i = 0; i < 15; i++) {
				await service.shouldSendPush("user-a", "CHEER_RECEIVED");
			}

			// Then — user-b는 영향 없음
			const result = await service.shouldSendPush("user-b", "CHEER_RECEIVED");
			expect(result).toBe(true);
		});
	});

	describe("getUserLocale", () => {
		it("preference에 locale이 있으면 그대로 반환한다", async () => {
			// Given
			userSettings.getPreferenceRecord.mockResolvedValue(
				UserPreferenceBuilder.create("user-1").withLocale("en").build(),
			);

			// When
			const result = await service.getUserLocale("user-1");

			// Then
			expect(result).toBe("en");
		});

		it("preference가 없으면 ko를 반환한다", async () => {
			// Given
			userSettings.getPreferenceRecord.mockResolvedValue(null);

			// When
			const result = await service.getUserLocale("user-1");

			// Then
			expect(result).toBe("ko");
		});

		it("구버전 캐시 엔트리(locale 필드 없음)는 ko로 내로잉한다", async () => {
			// Given — locale 도입 전 Redis에 적재된 엔트리 시뮬레이션
			cacheService.wrapUserPreference.mockResolvedValue({
				pushEnabled: true,
				nightPushEnabled: false,
				timezone: "Asia/Seoul",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR",
				weatherMorningEnabled: true,
				weatherMorningHour: 7,
				weatherMorningMinute: 0,
				weatherEveningEnabled: true,
				weatherEveningHour: 17,
				weatherEveningMinute: 30,
			});

			// When
			const result = await service.getUserLocale("user-1");

			// Then
			expect(result).toBe("ko");
		});

		it("shouldSendPush와 같은 캐시 래퍼(wrapUserPreference)를 사용한다", async () => {
			// Given
			userSettings.getPreferenceRecord.mockResolvedValue(
				UserPreferenceBuilder.create("user-1").withLocale("en").build(),
			);

			// When
			await service.getUserLocale("user-1");
			await service.shouldSendPush("user-1", "FOLLOW_NEW");

			// Then — 두 경로 모두 동일 캐시 키 래퍼 경유
			expect(cacheService.wrapUserPreference).toHaveBeenCalledTimes(2);
			expect(cacheService.wrapUserPreference).toHaveBeenNthCalledWith(
				1,
				"user-1",
				expect.any(Function),
			);
		});
	});

	describe("fireAndForgetPush", () => {
		it("활성 토큰으로 푸시를 발송한다", async () => {
			// Given
			const token = PushTokenBuilder.create("user-1").build();
			notificationRepository.findPushTokensByUser.mockResolvedValue([token]);
			pushProvider.sendBatch.mockResolvedValue({
				total: 1,
				successCount: 1,
				failureCount: 0,
				results: [{ success: true }],
				invalidTokens: [],
			});

			// When
			service.fireAndForgetPush(
				{
					userId: "user-1",
					type: "FOLLOW_NEW",
					title: "축하",
					body: "완료!",
				},
				1,
			);

			// Then — fire-and-forget이므로 promise 해결을 기다림
			await service.beforeApplicationShutdown();
			expect(pushProvider.sendBatch).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						token: token.token,
						title: "축하",
						body: "완료!",
					}),
				]),
			);
		});

		it("토큰이 없으면 발송하지 않는다", async () => {
			// Given
			notificationRepository.findPushTokensByUser.mockResolvedValue([]);

			// When
			service.fireAndForgetPush(
				{
					userId: "user-1",
					type: "FOLLOW_NEW",
					title: "축하",
					body: "완료!",
				},
				1,
			);

			// Then
			await service.beforeApplicationShutdown();
			expect(pushProvider.sendBatch).not.toHaveBeenCalled();
		});

		it("유효하지 않은 토큰을 비활성화한다", async () => {
			// Given
			const token = PushTokenBuilder.create("user-1").build();
			notificationRepository.findPushTokensByUser.mockResolvedValue([token]);
			pushProvider.sendBatch.mockResolvedValue({
				total: 1,
				successCount: 0,
				failureCount: 1,
				results: [{ success: false, error: "InvalidToken" }],
				invalidTokens: [token.token],
			});

			// When
			service.fireAndForgetPush(
				{
					userId: "user-1",
					type: "FOLLOW_NEW",
					title: "축하",
					body: "완료!",
				},
				1,
			);

			// Then
			await service.beforeApplicationShutdown();
			expect(
				notificationRepository.deactivateInvalidTokens,
			).toHaveBeenCalledWith([token.token]);
			expect(cacheService.invalidatePushTokens).toHaveBeenCalledWith("user-1");
		});
	});

	describe("fireAndForgetBatchPush", () => {
		it("여러 사용자에게 일괄 발송한다", async () => {
			// Given
			const token1 = PushTokenBuilder.create("user-1").build();
			const token2 = PushTokenBuilder.create("user-2").build();

			userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
				UserPreferenceBuilder.create("user-1")
					.withNightPushEnabled(true)
					.build(),
				UserPreferenceBuilder.create("user-2")
					.withNightPushEnabled(true)
					.build(),
			]);
			userSettings.getConsentRecordsByUserIds.mockResolvedValue([]);
			notificationRepository.findActivePushTokensByUsers.mockResolvedValue([
				token1,
				token2,
			]);
			pushProvider.sendBatch.mockResolvedValue({
				total: 2,
				successCount: 2,
				failureCount: 0,
				results: [],
				invalidTokens: [],
			});

			// When
			service.fireAndForgetBatchPush([
				{
					userId: "user-1",
					type: "MORNING_REMINDER",
					title: "아침",
					body: "좋은 아침!",
				},
				{
					userId: "user-2",
					type: "MORNING_REMINDER",
					title: "아침",
					body: "좋은 아침!",
				},
			]);

			// Then
			await service.beforeApplicationShutdown();
			expect(pushProvider.sendBatch).toHaveBeenCalled();
		});

		it("설정 미충족 사용자를 필터링한다", async () => {
			// Given — user-2는 pushEnabled=false
			userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
				UserPreferenceBuilder.create("user-1")
					.withNightPushEnabled(true)
					.build(),
				UserPreferenceBuilder.create("user-2").withPushDisabled().build(),
			]);
			userSettings.getConsentRecordsByUserIds.mockResolvedValue([]);
			const token1 = PushTokenBuilder.create("user-1").build();
			notificationRepository.findActivePushTokensByUsers.mockResolvedValue([
				token1,
			]);
			pushProvider.sendBatch.mockResolvedValue({
				total: 1,
				successCount: 1,
				failureCount: 0,
				results: [],
				invalidTokens: [],
			});

			// When
			service.fireAndForgetBatchPush([
				{
					userId: "user-1",
					type: "MORNING_REMINDER",
					title: "아침",
					body: "좋은 아침!",
				},
				{
					userId: "user-2",
					type: "MORNING_REMINDER",
					title: "아침",
					body: "좋은 아침!",
				},
			]);

			// Then — user-1만 토큰 조회에 포함
			await service.beforeApplicationShutdown();
			expect(
				notificationRepository.findActivePushTokensByUsers,
			).toHaveBeenCalledWith(["user-1"]);
		});

		it("대상자가 없으면 발송하지 않는다", async () => {
			// Given — 모든 사용자가 pushEnabled=false
			userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([
				UserPreferenceBuilder.create("user-1").withPushDisabled().build(),
			]);
			userSettings.getConsentRecordsByUserIds.mockResolvedValue([]);

			// When
			service.fireAndForgetBatchPush([
				{
					userId: "user-1",
					type: "MORNING_REMINDER",
					title: "아침",
					body: "좋은 아침!",
				},
			]);

			// Then
			await service.beforeApplicationShutdown();
			expect(
				notificationRepository.findActivePushTokensByUsers,
			).not.toHaveBeenCalled();
			expect(pushProvider.sendBatch).not.toHaveBeenCalled();
		});
	});

	describe("beforeApplicationShutdown", () => {
		it("pending push가 없으면 즉시 반환한다", async () => {
			// When / Then
			await expect(service.beforeApplicationShutdown()).resolves.not.toThrow();
		});

		it("pending push가 있으면 완료를 기다린다", async () => {
			// Given — 느린 push를 시작
			let resolveSlowPush: () => void = () => {};
			const slowPromise = new Promise<void>((resolve) => {
				resolveSlowPush = resolve;
			});

			notificationRepository.findPushTokensByUser.mockReturnValue(
				slowPromise.then((): PushToken[] => []),
			);

			service.fireAndForgetPush(
				{
					userId: "user-1",
					type: "FOLLOW_NEW",
					title: "t",
					body: "b",
				},
				1,
			);

			// When — shutdown 시작 (완료 대기)
			let shutdownDone = false;
			const shutdownPromise = service.beforeApplicationShutdown().then(() => {
				shutdownDone = true;
			});

			// Then — 아직 완료 안됨
			await Promise.resolve(); // microtask flush
			expect(shutdownDone).toBe(false);

			// push 완료 후 shutdown도 완료
			resolveSlowPush();
			await shutdownPromise;
			expect(shutdownDone).toBe(true);
		});
	});
});
