/**
 * UserSettingsService 테스트 (Suites 패턴)
 *
 * NestJS 공식 권장 Suites 라이브러리 사용
 * - 자동 Mock 생성으로 보일러플레이트 제거
 * - GWT 주석으로 테스트 의도 명확화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { CacheService } from "@/common/cache/cache.service";
import { EntitlementService } from "@/common/entitlement/entitlement.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import type { UserConsent, UserPreference } from "@/generated/prisma/client";

import { UserConsentRepository } from "../repositories/user-consent.repository";
import { UserPreferenceRepository } from "../repositories/user-preference.repository";
import { UserSettingsService } from "./user-settings.service";

describe("UserSettingsService", () => {
	let service: UserSettingsService;
	let userPreferenceRepo: Mocked<UserPreferenceRepository>;
	let userConsentRepo: Mocked<UserConsentRepository>;
	let entitlementService: Mocked<EntitlementService>;
	let cacheService: Mocked<CacheService>;

	beforeEach(async () => {
		// Given - Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } =
			await TestBed.solitary(UserSettingsService).compile();

		service = unit;
		userPreferenceRepo = unitRef.get(UserPreferenceRepository);
		userConsentRepo = unitRef.get(UserConsentRepository);
		entitlementService = unitRef.get(EntitlementService);
		cacheService = unitRef.get(CacheService);

		// 기본: 프리미엄 접근 허용 (기존 테스트 호환)
		entitlementService.hasPremiumAccess.mockResolvedValue(true);

		// 캐시 기본 동작: pass-through (캐시 미스 시뮬레이션)
		cacheService.wrapUserPreference.mockImplementation((_userId, factory) =>
			factory(),
		);
	});

	// ============================================
	// getPreference
	// ============================================

	describe("getPreference", () => {
		const userId = "user-123";

		const mockPreference: UserPreference = {
			id: "pref-123",
			userId,
			pushEnabled: true,
			nightPushEnabled: false,
			timezone: "Asia/Seoul",
			morningReminderHour: 7,
			morningReminderMinute: 30,
			eveningReminderHour: 20,
			eveningReminderMinute: 0,
			timeFormat: "TWELVE_HOUR",
			weatherMorningEnabled: true,
			weatherMorningHour: 7,
			weatherMorningMinute: 0,
			weatherEveningEnabled: true,
			weatherEveningHour: 18,
			weatherEveningMinute: 0,
			currentStreak: 0,
			longestStreak: 0,
			lastCompletedDate: null,
		};

		it("사용자의 푸시 설정을 반환해야 한다", async () => {
			// Given
			(userPreferenceRepo.findByUserId as jest.Mock).mockResolvedValue(
				mockPreference,
			);

			// When
			const result = await service.getPreference(userId);

			// Then
			expect(result).toEqual({
				pushEnabled: true,
				nightPushEnabled: false,
				timezone: "Asia/Seoul",
				morningReminderHour: 7,
				morningReminderMinute: 30,
				eveningReminderHour: 20,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR",
				weatherMorningEnabled: true,
				weatherMorningHour: 7,
				weatherMorningMinute: 0,
				weatherEveningEnabled: true,
				weatherEveningHour: 18,
				weatherEveningMinute: 0,
			});
			expect(userPreferenceRepo.findByUserId).toHaveBeenCalledWith(userId);
		});

		it("설정이 없으면 기본값(모두 false)을 반환해야 한다", async () => {
			// Given
			(userPreferenceRepo.findByUserId as jest.Mock).mockResolvedValue(null);

			// When
			const result = await service.getPreference(userId);

			// Then
			expect(result).toEqual({
				pushEnabled: false,
				nightPushEnabled: false,
				timezone: "UTC",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR",
				weatherMorningEnabled: true,
				weatherMorningHour: 7,
				weatherMorningMinute: 0,
				weatherEveningEnabled: true,
				weatherEveningHour: 18,
				weatherEveningMinute: 0,
			});
		});

		it("무료 유저의 getPreference가 고정 리마인더 시간을 반환한다", async () => {
			// Given - 무료 유저
			entitlementService.hasPremiumAccess.mockResolvedValue(false);
			(userPreferenceRepo.findByUserId as jest.Mock).mockResolvedValue(
				mockPreference,
			);

			// When
			const result = await service.getPreference(userId);

			// Then - 리마인더 시간은 고정값, 나머지는 DB 값
			expect(result).toEqual({
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
				weatherEveningHour: 18,
				weatherEveningMinute: 0,
			});
		});

		it("프리미엄 유저의 getPreference가 DB 저장값을 반환한다", async () => {
			// Given - 프리미엄 유저 (기본 mock은 true)
			(userPreferenceRepo.findByUserId as jest.Mock).mockResolvedValue(
				mockPreference,
			);

			// When
			const result = await service.getPreference(userId);

			// Then - DB 저장값 그대로 반환
			expect(result).toEqual({
				pushEnabled: true,
				nightPushEnabled: false,
				timezone: "Asia/Seoul",
				morningReminderHour: 7,
				morningReminderMinute: 30,
				eveningReminderHour: 20,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR",
				weatherMorningEnabled: true,
				weatherMorningHour: 7,
				weatherMorningMinute: 0,
				weatherEveningEnabled: true,
				weatherEveningHour: 18,
				weatherEveningMinute: 0,
			});
		});

		it("무료 유저도 pushEnabled/timezone은 DB 저장값을 반환한다", async () => {
			// Given - 무료 유저, pushEnabled=false, timezone=America/New_York
			entitlementService.hasPremiumAccess.mockResolvedValue(false);
			const customPref: UserPreference = {
				...mockPreference,
				pushEnabled: false,
				nightPushEnabled: true,
				timezone: "America/New_York",
			};
			(userPreferenceRepo.findByUserId as jest.Mock).mockResolvedValue(
				customPref,
			);

			// When
			const result = await service.getPreference(userId);

			// Then - push/timezone은 DB값, 리마인더 시간은 고정값
			expect(result).toEqual({
				pushEnabled: false,
				nightPushEnabled: true,
				timezone: "America/New_York",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR",
				weatherMorningEnabled: true,
				weatherMorningHour: 7,
				weatherMorningMinute: 0,
				weatherEveningEnabled: true,
				weatherEveningHour: 18,
				weatherEveningMinute: 0,
			});
		});
	});

	// ============================================
	// updatePreference
	// ============================================

	describe("updatePreference", () => {
		const userId = "user-123";

		const updatedPreference: UserPreference = {
			id: "pref-123",
			userId,
			pushEnabled: true,
			nightPushEnabled: true,
			timezone: "UTC",
			morningReminderHour: 8,
			morningReminderMinute: 0,
			eveningReminderHour: 18,
			eveningReminderMinute: 0,
			timeFormat: "TWELVE_HOUR",
			weatherMorningEnabled: true,
			weatherMorningHour: 7,
			weatherMorningMinute: 0,
			weatherEveningEnabled: true,
			weatherEveningHour: 18,
			weatherEveningMinute: 0,
			currentStreak: 0,
			longestStreak: 0,
			lastCompletedDate: null,
		};

		it("푸시 설정을 업데이트하고 결과를 반환해야 한다", async () => {
			// Given
			(userPreferenceRepo.upsert as jest.Mock).mockResolvedValue(
				updatedPreference,
			);

			// When
			const result = await service.updatePreference(userId, {
				pushEnabled: true,
				nightPushEnabled: true,
			});

			// Then
			expect(result).toEqual({
				pushEnabled: true,
				nightPushEnabled: true,
				timezone: "UTC",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR",
				weatherMorningEnabled: true,
				weatherMorningHour: 7,
				weatherMorningMinute: 0,
				weatherEveningEnabled: true,
				weatherEveningHour: 18,
				weatherEveningMinute: 0,
			});
			expect(userPreferenceRepo.upsert).toHaveBeenCalledWith(userId, {
				pushEnabled: true,
				nightPushEnabled: true,
				timeFormat: undefined,
			});
			expect(cacheService.invalidateUserPreference).toHaveBeenCalledWith(
				userId,
			);
		});

		it("일부 설정만 업데이트할 수 있어야 한다", async () => {
			// Given
			const partialUpdate: UserPreference = {
				id: "pref-123",
				userId,
				pushEnabled: false,
				nightPushEnabled: false,
				timezone: "UTC",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR",
				weatherMorningEnabled: true,
				weatherMorningHour: 7,
				weatherMorningMinute: 0,
				weatherEveningEnabled: true,
				weatherEveningHour: 18,
				weatherEveningMinute: 0,
				currentStreak: 0,
				longestStreak: 0,
				lastCompletedDate: null,
			};
			(userPreferenceRepo.upsert as jest.Mock).mockResolvedValue(partialUpdate);

			// When
			const result = await service.updatePreference(userId, {
				pushEnabled: false,
			});

			// Then
			expect(result).toEqual({
				pushEnabled: false,
				nightPushEnabled: false,
				timezone: "UTC",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR",
				weatherMorningEnabled: true,
				weatherMorningHour: 7,
				weatherMorningMinute: 0,
				weatherEveningEnabled: true,
				weatherEveningHour: 18,
				weatherEveningMinute: 0,
			});
			expect(userPreferenceRepo.upsert).toHaveBeenCalledWith(userId, {
				pushEnabled: false,
				nightPushEnabled: undefined,
				morningReminderMinute: undefined,
				eveningReminderMinute: undefined,
				timeFormat: undefined,
			});
		});
	});

	// ============================================
	// updatePreference — 리마인더 프리미엄 체크
	// ============================================

	describe("리마인더 시간 변경 — 프리미엄 체크", () => {
		const userId = "user-123";

		const updatedPreference: UserPreference = {
			id: "pref-123",
			userId,
			pushEnabled: true,
			nightPushEnabled: false,
			timezone: "Asia/Seoul",
			morningReminderHour: 7,
			morningReminderMinute: 0,
			eveningReminderHour: 20,
			eveningReminderMinute: 0,
			timeFormat: "TWELVE_HOUR",
			weatherMorningEnabled: true,
			weatherMorningHour: 7,
			weatherMorningMinute: 0,
			weatherEveningEnabled: true,
			weatherEveningHour: 18,
			weatherEveningMinute: 0,
			currentStreak: 0,
			longestStreak: 0,
			lastCompletedDate: null,
		};

		it("Free 유저가 morningReminderHour 변경 시 PREFERENCE_1701 에러", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(false);

			// When & Then
			await expect(
				service.updatePreference(userId, { morningReminderHour: 7 }),
			).rejects.toThrow(BusinessException);
		});

		it("Free 유저가 eveningReminderHour 변경 시 PREFERENCE_1701 에러", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(false);

			// When & Then
			await expect(
				service.updatePreference(userId, { eveningReminderHour: 20 }),
			).rejects.toThrow(BusinessException);
		});

		it("Free 유저가 morningReminderMinute 변경 시 PREFERENCE_1701 에러", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(false);

			// When & Then
			await expect(
				service.updatePreference(userId, { morningReminderMinute: 30 }),
			).rejects.toThrow(BusinessException);
		});

		it("Free 유저가 eveningReminderMinute 변경 시 PREFERENCE_1701 에러", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(false);

			// When & Then
			await expect(
				service.updatePreference(userId, { eveningReminderMinute: 30 }),
			).rejects.toThrow(BusinessException);
		});

		it("Free 유저가 pushEnabled만 변경 시 정상 동작", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(false);
			(userPreferenceRepo.upsert as jest.Mock).mockResolvedValue({
				...updatedPreference,
				pushEnabled: false,
			});

			// When
			const result = await service.updatePreference(userId, {
				pushEnabled: false,
			});

			// Then — hasPremiumAccess 호출되지 않음 (리마인더 시간 미변경)
			expect(entitlementService.hasPremiumAccess).not.toHaveBeenCalled();
			expect(result.pushEnabled).toBe(false);
		});

		it("Premium 유저는 morningReminderHour 변경 가능", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(true);
			(userPreferenceRepo.upsert as jest.Mock).mockResolvedValue(
				updatedPreference,
			);

			// When
			const result = await service.updatePreference(userId, {
				morningReminderHour: 7,
			});

			// Then
			expect(result.morningReminderHour).toBe(7);
		});

		it("Premium 유저는 eveningReminderHour 변경 가능", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(true);
			(userPreferenceRepo.upsert as jest.Mock).mockResolvedValue(
				updatedPreference,
			);

			// When
			const result = await service.updatePreference(userId, {
				eveningReminderHour: 20,
			});

			// Then
			expect(result.eveningReminderHour).toBe(20);
		});
	});

	// ============================================
	// updatePreference — 리마인더 시간 범위 검증
	// ============================================

	describe("리마인더 시간 범위 검증", () => {
		const userId = "user-123";

		const basePref: UserPreference = {
			id: "pref-123",
			userId,
			pushEnabled: true,
			nightPushEnabled: false,
			timezone: "Asia/Seoul",
			morningReminderHour: 7,
			morningReminderMinute: 0,
			eveningReminderHour: 20,
			eveningReminderMinute: 0,
			timeFormat: "TWELVE_HOUR",
			weatherMorningEnabled: true,
			weatherMorningHour: 7,
			weatherMorningMinute: 0,
			weatherEveningEnabled: true,
			weatherEveningHour: 18,
			weatherEveningMinute: 0,
			currentStreak: 0,
			longestStreak: 0,
			lastCompletedDate: null,
		};

		it("morningReminderHour가 12 이상이면 PREFERENCE_1702 에러", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(true);

			// When & Then
			await expect(
				service.updatePreference(userId, { morningReminderHour: 12 }),
			).rejects.toThrow(BusinessException);
		});

		it("eveningReminderHour가 11 이하이면 PREFERENCE_1702 에러", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(true);

			// When & Then
			await expect(
				service.updatePreference(userId, { eveningReminderHour: 11 }),
			).rejects.toThrow(BusinessException);
		});

		it("morningReminderHour 0 (경계값) 정상 동작", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(true);
			(userPreferenceRepo.upsert as jest.Mock).mockResolvedValue({
				...basePref,
				morningReminderHour: 0,
			});

			// When
			const result = await service.updatePreference(userId, {
				morningReminderHour: 0,
			});

			// Then
			expect(result.morningReminderHour).toBe(0);
		});

		it("morningReminderHour 11 (경계값) 정상 동작", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(true);
			(userPreferenceRepo.upsert as jest.Mock).mockResolvedValue({
				...basePref,
				morningReminderHour: 11,
			});

			// When
			const result = await service.updatePreference(userId, {
				morningReminderHour: 11,
			});

			// Then
			expect(result.morningReminderHour).toBe(11);
		});

		it("eveningReminderHour 12 (경계값) 정상 동작", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(true);
			(userPreferenceRepo.upsert as jest.Mock).mockResolvedValue({
				...basePref,
				eveningReminderHour: 12,
			});

			// When
			const result = await service.updatePreference(userId, {
				eveningReminderHour: 12,
			});

			// Then
			expect(result.eveningReminderHour).toBe(12);
		});

		it("eveningReminderHour 23 (경계값) 정상 동작", async () => {
			// Given
			entitlementService.hasPremiumAccess.mockResolvedValue(true);
			(userPreferenceRepo.upsert as jest.Mock).mockResolvedValue({
				...basePref,
				eveningReminderHour: 23,
			});

			// When
			const result = await service.updatePreference(userId, {
				eveningReminderHour: 23,
			});

			// Then
			expect(result.eveningReminderHour).toBe(23);
		});
	});

	// ============================================
	// getConsent
	// ============================================

	describe("getConsent", () => {
		const userId = "user-123";

		const mockConsent: UserConsent = {
			id: "consent-123",
			userId,
			termsAgreedAt: new Date("2026-01-17T10:00:00.000Z"),
			privacyAgreedAt: new Date("2026-01-17T10:00:00.000Z"),
			agreedTermsVersion: "1.0.0",
			marketingAgreedAt: null,
		};

		it("사용자의 동의 상태를 반환해야 한다", async () => {
			// Given
			(userConsentRepo.findByUserId as jest.Mock).mockResolvedValue(
				mockConsent,
			);

			// When
			const result = await service.getConsent(userId);

			// Then
			expect(result).toEqual({
				termsAgreedAt: "2026-01-17T10:00:00.000Z",
				privacyAgreedAt: "2026-01-17T10:00:00.000Z",
				agreedTermsVersion: "1.0.0",
				marketingAgreedAt: null,
			});
			expect(userConsentRepo.findByUserId).toHaveBeenCalledWith(userId);
		});

		it("마케팅 동의가 있는 경우 시간을 반환해야 한다", async () => {
			// Given
			const consentWithMarketing: UserConsent = {
				...mockConsent,
				marketingAgreedAt: new Date("2026-01-20T15:30:00.000Z"),
			};
			(userConsentRepo.findByUserId as jest.Mock).mockResolvedValue(
				consentWithMarketing,
			);

			// When
			const result = await service.getConsent(userId);

			// Then
			expect(result.marketingAgreedAt).toBe("2026-01-20T15:30:00.000Z");
		});

		it("동의 기록이 없으면 기본값(모두 null)을 반환해야 한다", async () => {
			// Given
			(userConsentRepo.findByUserId as jest.Mock).mockResolvedValue(null);

			// When
			const result = await service.getConsent(userId);

			// Then
			expect(result).toEqual({
				termsAgreedAt: null,
				privacyAgreedAt: null,
				agreedTermsVersion: null,
				marketingAgreedAt: null,
			});
		});
	});

	// ============================================
	// updateMarketingConsent
	// ============================================

	describe("updateMarketingConsent", () => {
		const userId = "user-123";

		it("마케팅 동의를 활성화하면 동의 시점을 반환해야 한다", async () => {
			// Given
			const agreedAt = new Date("2026-01-25T10:00:00.000Z");
			const updatedConsent: UserConsent = {
				id: "consent-123",
				userId,
				termsAgreedAt: new Date(),
				privacyAgreedAt: new Date(),
				agreedTermsVersion: "1.0.0",
				marketingAgreedAt: agreedAt,
			};
			(userConsentRepo.upsertMarketingConsent as jest.Mock).mockResolvedValue(
				updatedConsent,
			);

			// When
			const result = await service.updateMarketingConsent(userId, true);

			// Then
			expect(result).toEqual({
				marketingAgreedAt: "2026-01-25T10:00:00.000Z",
			});
			expect(userConsentRepo.upsertMarketingConsent).toHaveBeenCalledWith(
				userId,
				{ agreed: true },
			);
		});

		it("마케팅 동의를 철회하면 null을 반환해야 한다", async () => {
			// Given
			const updatedConsent: UserConsent = {
				id: "consent-123",
				userId,
				termsAgreedAt: new Date(),
				privacyAgreedAt: new Date(),
				agreedTermsVersion: "1.0.0",
				marketingAgreedAt: null,
			};
			(userConsentRepo.upsertMarketingConsent as jest.Mock).mockResolvedValue(
				updatedConsent,
			);

			// When
			const result = await service.updateMarketingConsent(userId, false);

			// Then
			expect(result).toEqual({
				marketingAgreedAt: null,
			});
			expect(userConsentRepo.upsertMarketingConsent).toHaveBeenCalledWith(
				userId,
				{ agreed: false },
			);
		});
	});
});
