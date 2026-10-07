import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { GetConsentRecord } from "./get-consent-record.use-case.js";

describe("GetConsentRecord — 알림 자격 판정용 동의 원본", () => {
  it("ISO 문자열 변환 없이 Date·선택 동의 null을 제공하고 다른 사용자의 기록을 섞지 않는다", async () => {
    // Given
    const fixture = createUserSettingsFixture({
      consent: {
        termsAgreedAt: SETTINGS_TIME,
        privacyAgreedAt: SETTINGS_TIME,
        marketingPushAgreedAt: SETTINGS_TIME,
      },
    });
    const useCase = new GetConsentRecord(fixture);
    // When
    const record = await useCase.execute({ userId: fixture.userId });
    const missing = await useCase.execute({ userId: "other-user" });
    // Then
    expect(record).toMatchObject({
      termsAgreedAt: SETTINGS_TIME,
      marketingPushAgreedAt: SETTINGS_TIME,
      marketingAgreedAt: null,
    });
    expect(missing).toBeNull();
  });
});
