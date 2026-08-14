/**
 * SettingsController 컨트롤러 단위 테스트
 *
 * @description
 * SettingsController의 엔드포인트 핸들러를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test user-settings.controller
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/presentation/decorators";

import { GetConsentUseCase } from "../application/use-cases/get-consent/get-consent.use-case";
import { GetPreferenceUseCase } from "../application/use-cases/get-preference/get-preference.use-case";
import { UpdateMarketingConsentUseCase } from "../application/use-cases/update-marketing-consent/update-marketing-consent.use-case";
import { UpdatePreferenceUseCase } from "../application/use-cases/update-preference/update-preference.use-case";
import { SettingsController } from "./user-settings.controller";

const WEATHER_DEFAULTS = {
	weatherMorningEnabled: false,
	weatherMorningHour: 7,
	weatherMorningMinute: 0,
	weatherEveningEnabled: false,
	weatherEveningHour: 18,
	weatherEveningMinute: 0,
} as const;

describe("SettingsController — 사용자 설정 컨트롤러", () => {
	let controller: SettingsController;
	let getPreferenceUseCase: Mocked<GetPreferenceUseCase>;
	let updatePreferenceUseCase: Mocked<UpdatePreferenceUseCase>;
	let getConsentUseCase: Mocked<GetConsentUseCase>;
	let updateMarketingConsentUseCase: Mocked<UpdateMarketingConsentUseCase>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SettingsController).compile();

		controller = unit;
		getPreferenceUseCase = unitRef.get(GetPreferenceUseCase);
		updatePreferenceUseCase = unitRef.get(UpdatePreferenceUseCase);
		getConsentUseCase = unitRef.get(GetConsentUseCase);
		updateMarketingConsentUseCase = unitRef.get(UpdateMarketingConsentUseCase);
	});

	describe("getPreference", () => {
		it("사용자의 푸시 설정을 반환해야 한다", async () => {
			// Given
			const expectedResult = {
				pushEnabled: true,
				nightPushEnabled: false,
				timezone: "Asia/Seoul",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR" as const,
				...WEATHER_DEFAULTS,
			};
			getPreferenceUseCase.execute.mockResolvedValue(expectedResult);

			// When
			const result = await controller.getPreference(mockUser);

			// Then
			expect(getPreferenceUseCase.execute).toHaveBeenCalledWith(mockUser.userId);
			expect(result).toEqual(expectedResult);
		});

		it("설정이 없으면 기본값을 반환해야 한다", async () => {
			// Given
			const defaultResult = {
				pushEnabled: false,
				nightPushEnabled: false,
				timezone: "UTC",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR" as const,
				...WEATHER_DEFAULTS,
			};
			getPreferenceUseCase.execute.mockResolvedValue(defaultResult);

			// When
			const result = await controller.getPreference(mockUser);

			// Then
			expect(result).toEqual(defaultResult);
		});
	});

	describe("updatePreference", () => {
		it("푸시 설정을 업데이트하고 결과를 반환해야 한다", async () => {
			// Given
			const dto = { pushEnabled: true, nightPushEnabled: true };
			const expectedResult = {
				pushEnabled: true,
				nightPushEnabled: true,
				timezone: "Asia/Seoul",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR" as const,
				...WEATHER_DEFAULTS,
			};
			updatePreferenceUseCase.execute.mockResolvedValue(expectedResult);

			// When
			const result = await controller.updatePreference(mockUser, dto);

			// Then
			expect(updatePreferenceUseCase.execute).toHaveBeenCalledWith(mockUser.userId, dto);
			expect(result).toEqual(expectedResult);
		});

		it("일부 설정만 업데이트할 수 있어야 한다", async () => {
			// Given
			const dto = { pushEnabled: true };
			const expectedResult = {
				pushEnabled: true,
				nightPushEnabled: false,
				timezone: "UTC",
				morningReminderHour: 8,
				morningReminderMinute: 0,
				eveningReminderHour: 18,
				eveningReminderMinute: 0,
				timeFormat: "TWELVE_HOUR" as const,
				...WEATHER_DEFAULTS,
			};
			updatePreferenceUseCase.execute.mockResolvedValue(expectedResult);

			// When
			const result = await controller.updatePreference(mockUser, dto);

			// Then
			expect(updatePreferenceUseCase.execute).toHaveBeenCalledWith(mockUser.userId, dto);
			expect(result).toEqual(expectedResult);
		});
	});

	describe("getConsent", () => {
		it("사용자의 동의 상태를 반환해야 한다", async () => {
			// Given
			const expectedResult = {
				termsAgreedAt: "2024-01-01T00:00:00.000Z",
				privacyAgreedAt: "2024-01-01T00:00:00.000Z",
				agreedTermsVersion: "1.0",
				marketingAgreedAt: null,
				marketingPushAgreedAt: null,
			};
			getConsentUseCase.execute.mockResolvedValue(expectedResult);

			// When
			const result = await controller.getConsent(mockUser);

			// Then
			expect(getConsentUseCase.execute).toHaveBeenCalledWith(mockUser.userId);
			expect(result).toEqual(expectedResult);
		});

		it("동의 기록이 없으면 기본값을 반환해야 한다", async () => {
			// Given
			const defaultResult = {
				termsAgreedAt: null,
				privacyAgreedAt: null,
				agreedTermsVersion: null,
				marketingAgreedAt: null,
				marketingPushAgreedAt: null,
			};
			getConsentUseCase.execute.mockResolvedValue(defaultResult);

			// When
			const result = await controller.getConsent(mockUser);

			// Then
			expect(result).toEqual(defaultResult);
		});
	});

	describe("updateMarketingConsent", () => {
		it("마케팅 동의를 활성화하면 동의 시점을 반환해야 한다", async () => {
			// Given
			const dto = { agreed: true };
			const expectedResult = {
				marketingAgreedAt: "2024-01-15T10:00:00.000Z",
			};
			updateMarketingConsentUseCase.execute.mockResolvedValue(expectedResult);

			// When
			const result = await controller.updateMarketingConsent(mockUser, dto);

			// Then
			expect(updateMarketingConsentUseCase.execute).toHaveBeenCalledWith(mockUser.userId, true);
			expect(result).toEqual(expectedResult);
		});

		it("마케팅 동의를 철회하면 null을 반환해야 한다", async () => {
			// Given
			const dto = { agreed: false };
			const expectedResult = { marketingAgreedAt: null };
			updateMarketingConsentUseCase.execute.mockResolvedValue(expectedResult);

			// When
			const result = await controller.updateMarketingConsent(mockUser, dto);

			// Then
			expect(updateMarketingConsentUseCase.execute).toHaveBeenCalledWith(mockUser.userId, false);
			expect(result).toEqual(expectedResult);
		});
	});
});
