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

import type { UserConsent, UserPreference } from "@/generated/prisma/client";

import { UserConsentRepository } from "../repositories/user-consent.repository";
import { UserPreferenceRepository } from "../repositories/user-preference.repository";
import { UserSettingsService } from "./user-settings.service";

describe("UserSettingsService", () => {
	let service: UserSettingsService;
	let userPreferenceRepo: Mocked<UserPreferenceRepository>;
	let userConsentRepo: Mocked<UserConsentRepository>;

	beforeEach(async () => {
		// Given - Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } =
			await TestBed.solitary(UserSettingsService).compile();

		service = unit;
		userPreferenceRepo = unitRef.get(
			UserPreferenceRepository,
		) as unknown as Mocked<UserPreferenceRepository>;
		userConsentRepo = unitRef.get(
			UserConsentRepository,
		) as unknown as Mocked<UserConsentRepository>;
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
			});
			expect(userPreferenceRepo.upsert).toHaveBeenCalledWith(userId, {
				pushEnabled: true,
				nightPushEnabled: true,
			});
		});

		it("일부 설정만 업데이트할 수 있어야 한다", async () => {
			// Given
			const partialUpdate: UserPreference = {
				id: "pref-123",
				userId,
				pushEnabled: false,
				nightPushEnabled: false,
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
			});
			expect(userPreferenceRepo.upsert).toHaveBeenCalledWith(userId, {
				pushEnabled: false,
				nightPushEnabled: undefined,
			});
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
