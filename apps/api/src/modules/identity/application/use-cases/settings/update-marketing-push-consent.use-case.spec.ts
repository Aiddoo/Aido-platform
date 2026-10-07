import { vi } from "vitest";

import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { UpdateMarketingPushConsent } from "./update-marketing-push-consent.use-case.js";

describe("UpdateMarketingPushConsent — 광고성 푸시 선택 동의", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SETTINGS_TIME);
  });
  afterEach(() => vi.useRealTimers());
  it("활성화·철회는 광고성 푸시 동의만 바꾸고 일반 마케팅 동의를 보존한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ consent: { marketingAgreedAt: SETTINGS_TIME } });
    const useCase = new UpdateMarketingPushConsent(fixture);
    // When
    const agreed = await useCase.execute({ userId: fixture.userId, agreed: true });
    const revoked = await useCase.execute({ userId: fixture.userId, agreed: false });
    // Then
    expect(agreed.marketingPushAgreedAt).toBe(SETTINGS_TIME.toISOString());
    expect(revoked.marketingPushAgreedAt).toBeNull();
    expect(fixture.consentRepository.records.get(fixture.userId)).toEqual({
      ...fixture.consent,
      marketingPushAgreedAt: null,
    });
  });
  it("동의 기록이 없으면 광고성 푸시 동의만 생성한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ consent: null });
    // When
    await new UpdateMarketingPushConsent(fixture).execute({ userId: fixture.userId, agreed: true });
    // Then
    expect(fixture.consentRepository.records.get(fixture.userId)).toEqual({
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: null,
      marketingPushAgreedAt: SETTINGS_TIME,
    });
  });
});
