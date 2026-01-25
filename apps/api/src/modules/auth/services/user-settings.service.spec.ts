import { Test, type TestingModule } from "@nestjs/testing";

import type { UserConsent, UserPreference } from "@/generated/prisma/client";

import { UserConsentRepository } from "../repositories/user-consent.repository";
import { UserPreferenceRepository } from "../repositories/user-preference.repository";
import { UserSettingsService } from "./user-settings.service";

describe("UserSettingsService", () => {
	let service: UserSettingsService;

	// Mock 객체들
	const mockUserPreferenceRepository = {
		findByUserId: jest.fn(),
		upsert: jest.fn(),
	};

	const mockUserConsentRepository = {
		findByUserId: jest.fn(),
		upsertMarketingConsent: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UserSettingsService,
				{
					provide: UserPreferenceRepository,
					useValue: mockUserPreferenceRepository,
				},
				{
					provide: UserConsentRepository,
					useValue: mockUserConsentRepository,
				},
			],
		}).compile();

		service = module.get<UserSettingsService>(UserSettingsService);
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
			mockUserPreferenceRepository.findByUserId.mockResolvedValue(
				mockPreference,
			);

			const result = await service.getPreference(userId);

			expect(result).toEqual({
				pushEnabled: true,
				nightPushEnabled: false,
			});
			expect(mockUserPreferenceRepository.findByUserId).toHaveBeenCalledWith(
				userId,
			);
		});

		it("설정이 없으면 기본값(모두 false)을 반환해야 한다", async () => {
			mockUserPreferenceRepository.findByUserId.mockResolvedValue(null);

			const result = await service.getPreference(userId);

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
			mockUserPreferenceRepository.upsert.mockResolvedValue(updatedPreference);

			const result = await service.updatePreference(userId, {
				pushEnabled: true,
				nightPushEnabled: true,
			});

			expect(result).toEqual({
				pushEnabled: true,
				nightPushEnabled: true,
			});
			expect(mockUserPreferenceRepository.upsert).toHaveBeenCalledWith(userId, {
				pushEnabled: true,
				nightPushEnabled: true,
			});
		});

		it("일부 설정만 업데이트할 수 있어야 한다", async () => {
			const partialUpdate: UserPreference = {
				id: "pref-123",
				userId,
				pushEnabled: false,
				nightPushEnabled: false,
			};
			mockUserPreferenceRepository.upsert.mockResolvedValue(partialUpdate);

			const result = await service.updatePreference(userId, {
				pushEnabled: false,
			});

			expect(result).toEqual({
				pushEnabled: false,
				nightPushEnabled: false,
			});
			expect(mockUserPreferenceRepository.upsert).toHaveBeenCalledWith(userId, {
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
			mockUserConsentRepository.findByUserId.mockResolvedValue(mockConsent);

			const result = await service.getConsent(userId);

			expect(result).toEqual({
				termsAgreedAt: "2026-01-17T10:00:00.000Z",
				privacyAgreedAt: "2026-01-17T10:00:00.000Z",
				agreedTermsVersion: "1.0.0",
				marketingAgreedAt: null,
			});
			expect(mockUserConsentRepository.findByUserId).toHaveBeenCalledWith(
				userId,
			);
		});

		it("마케팅 동의가 있는 경우 시간을 반환해야 한다", async () => {
			const consentWithMarketing: UserConsent = {
				...mockConsent,
				marketingAgreedAt: new Date("2026-01-20T15:30:00.000Z"),
			};
			mockUserConsentRepository.findByUserId.mockResolvedValue(
				consentWithMarketing,
			);

			const result = await service.getConsent(userId);

			expect(result.marketingAgreedAt).toBe("2026-01-20T15:30:00.000Z");
		});

		it("동의 기록이 없으면 기본값(모두 null)을 반환해야 한다", async () => {
			mockUserConsentRepository.findByUserId.mockResolvedValue(null);

			const result = await service.getConsent(userId);

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
			const agreedAt = new Date("2026-01-25T10:00:00.000Z");
			const updatedConsent: UserConsent = {
				id: "consent-123",
				userId,
				termsAgreedAt: new Date(),
				privacyAgreedAt: new Date(),
				agreedTermsVersion: "1.0.0",
				marketingAgreedAt: agreedAt,
			};
			mockUserConsentRepository.upsertMarketingConsent.mockResolvedValue(
				updatedConsent,
			);

			const result = await service.updateMarketingConsent(userId, true);

			expect(result).toEqual({
				marketingAgreedAt: "2026-01-25T10:00:00.000Z",
			});
			expect(
				mockUserConsentRepository.upsertMarketingConsent,
			).toHaveBeenCalledWith(userId, { agreed: true });
		});

		it("마케팅 동의를 철회하면 null을 반환해야 한다", async () => {
			const updatedConsent: UserConsent = {
				id: "consent-123",
				userId,
				termsAgreedAt: new Date(),
				privacyAgreedAt: new Date(),
				agreedTermsVersion: "1.0.0",
				marketingAgreedAt: null,
			};
			mockUserConsentRepository.upsertMarketingConsent.mockResolvedValue(
				updatedConsent,
			);

			const result = await service.updateMarketingConsent(userId, false);

			expect(result).toEqual({
				marketingAgreedAt: null,
			});
			expect(
				mockUserConsentRepository.upsertMarketingConsent,
			).toHaveBeenCalledWith(userId, { agreed: false });
		});
	});
});
