import { vi } from "vitest";

import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { UpdateMarketingConsent } from "./update-marketing-consent.use-case.js";

describe("UpdateMarketingConsent — 일반 마케팅 동의 변경", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SETTINGS_TIME);
  });
  afterEach(() => vi.useRealTimers());
  it("동의·재동의·철회는 해당 시각만 변경하고 약관·광고성 푸시 동의를 보존한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({
      consent: { marketingPushAgreedAt: SETTINGS_TIME },
    });
    const useCase = new UpdateMarketingConsent(fixture);
    // When
    const agreed = await useCase.execute({ userId: fixture.userId, agreed: true });
    vi.setSystemTime(SETTINGS_TIME.getTime() + 60_000);
    const reAgreed = await useCase.execute({ userId: fixture.userId, agreed: true });
    const revoked = await useCase.execute({ userId: fixture.userId, agreed: false });
    // Then
    expect(agreed.marketingAgreedAt).toBe(SETTINGS_TIME.toISOString());
    expect(reAgreed.marketingAgreedAt).toBe(
      new Date(SETTINGS_TIME.getTime() + 60_000).toISOString(),
    );
    expect(revoked.marketingAgreedAt).toBeNull();
    expect(fixture.consentRepository.records.get(fixture.userId)).toEqual({
      ...fixture.consent,
      marketingAgreedAt: null,
    });
  });
  it("기록이 없는 사용자의 선택 동의만 생성하며 필수 동의를 자동으로 채우지 않는다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ consent: null });
    // When
    await new UpdateMarketingConsent(fixture).execute({ userId: fixture.userId, agreed: true });
    // Then
    expect(fixture.consentRepository.records.get(fixture.userId)).toEqual({
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: SETTINGS_TIME,
      marketingPushAgreedAt: null,
    });
  });
});
