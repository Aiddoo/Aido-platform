import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { UpdateMarketingPushConsentUseCase } from "./update-marketing-push-consent.use-case.js";

describe("UpdateMarketingPushConsent — 광고성 푸시 선택 동의", () => {
  it("활성화·철회는 광고성 푸시 동의만 바꾸고 일반 마케팅 동의를 보존한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ consent: { marketingAgreedAt: SETTINGS_TIME } });
    const useCase = new UpdateMarketingPushConsentUseCase(fixture);
    // When
    const agreed = await useCase.execute({ userId: fixture.userId, agreed: true });
    const revoked = await useCase.execute({ userId: fixture.userId, agreed: false });
    // Then
    expect(agreed.marketingPushAgreedAt).toBe("2026-01-16T09:00:00.000Z");
    expect(revoked.marketingPushAgreedAt).toBeNull();
    expect(fixture.consentRepository.stored(fixture.userId)).toEqual({
      ...fixture.consent,
      marketingPushAgreedAt: null,
    });
  });
  it("동의 기록이 없으면 광고성 푸시 동의만 생성한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ consent: null });
    // When
    await new UpdateMarketingPushConsentUseCase(fixture).execute({
      userId: fixture.userId,
      agreed: true,
    });
    // Then
    expect(fixture.consentRepository.stored(fixture.userId)).toEqual({
      userId: fixture.userId,
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: null,
      marketingPushAgreedAt: SETTINGS_TIME,
      aiDataSharingAgreedAt: null,
      aiDataSharingVersion: null,
      marketingReconfirmedAt: null,
    });
  });
});
