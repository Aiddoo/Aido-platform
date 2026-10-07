import { TestBed } from "@suites/unit";
/**
 * SettingsController 컨트롤러 단위 테스트
 *
 * @description
 * SettingsController의 엔드포인트 핸들러를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test user-settings.controller
 * ```
 */
import type { Mocked } from "vitest";

import type { CurrentUserPayload } from "#api/modules/identity/presentation/decorators/auth/index";

import { GetConsent } from "../../../application/use-cases/settings/get-consent.use-case.js";
import { GetPreference } from "../../../application/use-cases/settings/get-preference.use-case.js";
import { UpdateMarketingConsent } from "../../../application/use-cases/settings/update-marketing-consent.use-case.js";
import { UpdatePreference } from "../../../application/use-cases/settings/update-preference.use-case.js";
import { SettingsController } from "./user-settings.controller.js";

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
  let getPreferenceUseCase: Mocked<GetPreference>;
  let updatePreferenceUseCase: Mocked<UpdatePreference>;
  let getConsentUseCase: Mocked<GetConsent>;
  let updateMarketingConsentUseCase: Mocked<UpdateMarketingConsent>;

  const mockUser: CurrentUserPayload = {
    userId: "user-123",
    email: "test@example.com",
    sessionId: "session-123",
    role: "USER",
  };

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(SettingsController).compile();

    controller = unit;
    getPreferenceUseCase = unitRef.get(GetPreference);
    updatePreferenceUseCase = unitRef.get(UpdatePreference);
    getConsentUseCase = unitRef.get(GetConsent);
    updateMarketingConsentUseCase = unitRef.get(UpdateMarketingConsent);
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
      expect(getPreferenceUseCase.execute).toHaveBeenCalledWith({ userId: mockUser.userId });
      expect(result).toEqual(expectedResult);
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
      expect(updatePreferenceUseCase.execute).toHaveBeenCalledWith({
        userId: mockUser.userId,
        ...dto,
      });
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
      expect(getConsentUseCase.execute).toHaveBeenCalledWith({ userId: mockUser.userId });
      expect(result).toEqual(expectedResult);
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
      expect(updateMarketingConsentUseCase.execute).toHaveBeenCalledWith({
        userId: mockUser.userId,
        agreed: true,
      });
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
      expect(updateMarketingConsentUseCase.execute).toHaveBeenCalledWith({
        userId: mockUser.userId,
        agreed: false,
      });
      expect(result).toEqual(expectedResult);
    });
  });
});
