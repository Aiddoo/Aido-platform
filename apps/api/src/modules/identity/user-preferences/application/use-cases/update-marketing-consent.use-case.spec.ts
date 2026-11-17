import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { UpdateMarketingConsentUseCase } from "./update-marketing-consent.use-case.js";

describe("UpdateMarketingConsent — 일반 마케팅 동의 변경", () => {
  it("동의·재동의·철회는 해당 시각만 변경하고 약관·광고성 푸시 동의를 보존한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({
      consent: { marketingPushAgreedAt: SETTINGS_TIME },
    });
    const useCase = new UpdateMarketingConsentUseCase(fixture);
    // When
    const agreed = await useCase.execute({ userId: fixture.userId, agreed: true });
    fixture.clock.advanceBy({ minutes: 1 });
    const reAgreed = await useCase.execute({ userId: fixture.userId, agreed: true });
    const revoked = await useCase.execute({ userId: fixture.userId, agreed: false });
    // Then
    expect(agreed.marketingAgreedAt).toBe("2026-01-16T09:00:00.000Z");
    expect(reAgreed.marketingAgreedAt).toBe("2026-01-16T09:01:00.000Z");
    expect(revoked.marketingAgreedAt).toBeNull();
    expect(fixture.consentRepository.stored(fixture.userId)).toEqual({
      ...fixture.consent,
      marketingAgreedAt: null,
    });
  });
  it("기록이 없는 사용자의 선택 동의만 생성하며 필수 동의를 자동으로 채우지 않는다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ consent: null });
    // When
    await new UpdateMarketingConsentUseCase(fixture).execute({
      userId: fixture.userId,
      agreed: true,
    });
    // Then
    expect(fixture.consentRepository.stored(fixture.userId)).toEqual({
      userId: fixture.userId,
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: SETTINGS_TIME,
      marketingPushAgreedAt: null,
      aiDataSharingAgreedAt: null,
      aiDataSharingVersion: null,
      marketingReconfirmedAt: null,
    });
  });
  it("철회 응답에는 처리한 서버 시각을, 동의 응답에는 null을 싣는다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ consent: { marketingAgreedAt: SETTINGS_TIME } });
    const useCase = new UpdateMarketingConsentUseCase(fixture);
    fixture.clock.advanceBy({ minutes: 1 });

    // When
    const withdrawn = await useCase.execute({ userId: fixture.userId, agreed: false });
    const agreed = await useCase.execute({ userId: fixture.userId, agreed: true });

    // Then
    expect(withdrawn).toEqual({
      marketingAgreedAt: null,
      marketingWithdrawnAt: "2026-01-16T09:01:00.000Z",
    });
    expect(agreed).toEqual({
      marketingAgreedAt: "2026-01-16T09:01:00.000Z",
      marketingWithdrawnAt: null,
    });
  });
});
