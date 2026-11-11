import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { GetConsentUseCase } from "./get-consent.use-case.js";

describe("GetConsent — 약관과 선택 동의의 nullable 응답", () => {
  it("기록이 없으면 모든 동의를 null로 반환하고 조회로 동의를 생성하지 않는다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ consent: null });
    // When
    const result = await new GetConsentUseCase(fixture).execute({ userId: fixture.userId });
    // Then
    expect(result).toEqual({
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
      aiDataSharingDecision: "UNDECIDED",
      aiDataSharingAgreedAt: null,
      aiDataSharingConsentVersion: null,
    });
    expect(fixture.consentRepository.all).toEqual([]);
  });
  it("저장된 시각은 ISO 문자열로 반환하고 선택 동의의 null은 유지한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({
      consent: { marketingPushAgreedAt: SETTINGS_TIME },
    });
    // When
    const result = await new GetConsentUseCase(fixture).execute({ userId: fixture.userId });
    // Then
    expect(result).toEqual({
      termsAgreedAt: "2026-01-16T09:00:00.000Z",
      privacyAgreedAt: "2026-01-16T09:00:00.000Z",
      agreedTermsVersion: fixture.consent.agreedTermsVersion,
      marketingAgreedAt: null,
      marketingPushAgreedAt: "2026-01-16T09:00:00.000Z",
      aiDataSharingDecision: "UNDECIDED",
      aiDataSharingAgreedAt: null,
      aiDataSharingConsentVersion: null,
    });
  });
});
