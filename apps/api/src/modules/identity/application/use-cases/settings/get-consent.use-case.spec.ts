import { vi } from "vitest";

import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { GetConsent } from "./get-consent.use-case.js";

describe("GetConsent — 약관과 선택 동의의 nullable 응답", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SETTINGS_TIME);
  });
  afterEach(() => vi.useRealTimers());
  it("기록이 없으면 모든 동의를 null로 반환하고 조회로 동의를 생성하지 않는다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ consent: null });
    // When
    const result = await new GetConsent(fixture).execute({ userId: fixture.userId });
    // Then
    expect(result).toEqual({
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
    });
    expect(fixture.consentRepository.records.size).toBe(0);
  });
  it("저장된 시각은 ISO 문자열로 반환하고 선택 동의의 null은 유지한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({
      consent: { marketingPushAgreedAt: SETTINGS_TIME },
    });
    // When
    const result = await new GetConsent(fixture).execute({ userId: fixture.userId });
    // Then
    expect(result).toEqual({
      termsAgreedAt: SETTINGS_TIME.toISOString(),
      privacyAgreedAt: SETTINGS_TIME.toISOString(),
      agreedTermsVersion: fixture.consent.agreedTermsVersion,
      marketingAgreedAt: null,
      marketingPushAgreedAt: SETTINGS_TIME.toISOString(),
    });
  });
});
