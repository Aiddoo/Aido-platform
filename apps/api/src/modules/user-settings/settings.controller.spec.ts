import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/modules/auth/decorators";

import { UserSettingsService } from "./services/user-settings.service";
import { SettingsController } from "./settings.controller";

describe("SettingsController", () => {
	let controller: SettingsController;
	let mockUserSettingsService: Mocked<UserSettingsService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(SettingsController).compile();

		controller = unit;
		mockUserSettingsService = unitRef.get(
			UserSettingsService,
		) as unknown as Mocked<UserSettingsService>;
	});

	describe("getPreference", () => {
		it("사용자의 푸시 설정을 반환해야 한다", async () => {
			const expectedResult = {
				pushEnabled: true,
				nightPushEnabled: false,
				timezone: "Asia/Seoul",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
			};
			mockUserSettingsService.getPreference.mockResolvedValue(expectedResult);

			const result = await controller.getPreference(mockUser);

			expect(mockUserSettingsService.getPreference).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual(expectedResult);
		});

		it("설정이 없으면 기본값을 반환해야 한다", async () => {
			const defaultResult = {
				pushEnabled: false,
				nightPushEnabled: false,
				timezone: "UTC",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
			};
			mockUserSettingsService.getPreference.mockResolvedValue(defaultResult);

			const result = await controller.getPreference(mockUser);

			expect(result).toEqual(defaultResult);
		});
	});

	describe("updatePreference", () => {
		it("푸시 설정을 업데이트하고 결과를 반환해야 한다", async () => {
			const dto = { pushEnabled: true, nightPushEnabled: true };
			const expectedResult = {
				pushEnabled: true,
				nightPushEnabled: true,
				timezone: "Asia/Seoul",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
			};
			mockUserSettingsService.updatePreference.mockResolvedValue(
				expectedResult,
			);

			const result = await controller.updatePreference(mockUser, dto);

			expect(mockUserSettingsService.updatePreference).toHaveBeenCalledWith(
				mockUser.userId,
				dto,
			);
			expect(result).toEqual(expectedResult);
		});

		it("일부 설정만 업데이트할 수 있어야 한다", async () => {
			const dto = { pushEnabled: true };
			const expectedResult = {
				pushEnabled: true,
				nightPushEnabled: false,
				timezone: "UTC",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
			};
			mockUserSettingsService.updatePreference.mockResolvedValue(
				expectedResult,
			);

			const result = await controller.updatePreference(mockUser, dto);

			expect(mockUserSettingsService.updatePreference).toHaveBeenCalledWith(
				mockUser.userId,
				dto,
			);
			expect(result).toEqual(expectedResult);
		});
	});

	describe("getConsent", () => {
		it("사용자의 동의 상태를 반환해야 한다", async () => {
			const expectedResult = {
				termsAgreedAt: "2024-01-01T00:00:00.000Z",
				privacyAgreedAt: "2024-01-01T00:00:00.000Z",
				agreedTermsVersion: "1.0",
				marketingAgreedAt: null,
			};
			mockUserSettingsService.getConsent.mockResolvedValue(expectedResult);

			const result = await controller.getConsent(mockUser);

			expect(mockUserSettingsService.getConsent).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual(expectedResult);
		});

		it("동의 기록이 없으면 기본값을 반환해야 한다", async () => {
			const defaultResult = {
				termsAgreedAt: null,
				privacyAgreedAt: null,
				agreedTermsVersion: null,
				marketingAgreedAt: null,
			};
			mockUserSettingsService.getConsent.mockResolvedValue(defaultResult);

			const result = await controller.getConsent(mockUser);

			expect(result).toEqual(defaultResult);
		});
	});

	describe("updateMarketingConsent", () => {
		it("마케팅 동의를 활성화하면 동의 시점을 반환해야 한다", async () => {
			const dto = { agreed: true };
			const expectedResult = {
				marketingAgreedAt: "2024-01-15T10:00:00.000Z",
			};
			mockUserSettingsService.updateMarketingConsent.mockResolvedValue(
				expectedResult,
			);

			const result = await controller.updateMarketingConsent(mockUser, dto);

			expect(
				mockUserSettingsService.updateMarketingConsent,
			).toHaveBeenCalledWith(mockUser.userId, true);
			expect(result).toEqual(expectedResult);
		});

		it("마케팅 동의를 철회하면 null을 반환해야 한다", async () => {
			const dto = { agreed: false };
			const expectedResult = { marketingAgreedAt: null };
			mockUserSettingsService.updateMarketingConsent.mockResolvedValue(
				expectedResult,
			);

			const result = await controller.updateMarketingConsent(mockUser, dto);

			expect(
				mockUserSettingsService.updateMarketingConsent,
			).toHaveBeenCalledWith(mockUser.userId, false);
			expect(result).toEqual(expectedResult);
		});
	});
});
