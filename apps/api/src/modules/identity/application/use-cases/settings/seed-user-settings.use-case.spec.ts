import { vi } from "vitest";

import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { SeedUserSettings } from "./seed-user-settings.use-case.js";

describe("SeedUserSettings — 가입 시 필수 동의와 기본 푸시 설정", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SETTINGS_TIME);
  });
  afterEach(() => vi.useRealTimers());
  it("받은 동의와 기본 푸시 플래그를 저장하고 선택 동의를 자동으로 만들지 않는다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ preference: null, consent: null });
    const consent = {
      termsAgreedAt: SETTINGS_TIME,
      privacyAgreedAt: SETTINGS_TIME,
      agreedTermsVersion: "2.0",
    };
    // When
    await new SeedUserSettings(fixture).execute({ userId: fixture.userId, consent });
    // Then
    expect(fixture.consentRepository.records.get(fixture.userId)).toEqual({
      ...consent,
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
    });
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toMatchObject({
      pushEnabled: true,
      nightPushEnabled: true,
      currentStreak: 0,
      lastCompletedDate: null,
    });
  });
  it("빈 동의 입력도 null 상태로 저장하며 푸시 기본값을 유지한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ preference: null, consent: null });
    // When
    await new SeedUserSettings(fixture).execute({ userId: fixture.userId, consent: {} });
    // Then
    expect(fixture.consentRepository.records.get(fixture.userId)).toEqual({
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
    });
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toMatchObject({
      pushEnabled: true,
      nightPushEnabled: true,
    });
  });
});
