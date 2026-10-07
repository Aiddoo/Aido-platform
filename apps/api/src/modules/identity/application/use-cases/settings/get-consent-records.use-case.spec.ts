import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { GetConsentRecords } from "./get-consent-records.use-case.js";

describe("GetConsentRecords — 알림 수신 동의의 배치 조회", () => {
  it("요청한 사용자만 한 번의 배치 조회로 구분하고 광고성 푸시 동의·철회 상태를 유지한다", async () => {
    // Given
    const fixture = createUserSettingsFixture();
    fixture.consentRepository.records.set("other-user", {
      ...fixture.consent,
      marketingPushAgreedAt: SETTINGS_TIME,
    });
    fixture.consentRepository.records.set("excluded-user", fixture.consent);
    // When
    const records = await new GetConsentRecords(fixture).execute({
      userIds: ["other-user", "missing-user", fixture.userId],
    });
    // Then
    const byUserId = new Map(records.map((record) => [record.userId, record]));
    expect([...byUserId.keys()].sort()).toEqual(["other-user", fixture.userId].sort());
    expect(byUserId.get("other-user")?.marketingPushAgreedAt).toEqual(SETTINGS_TIME);
    expect(byUserId.get(fixture.userId)?.marketingPushAgreedAt).toBeNull();
    expect(fixture.consentRepository.batchReads).toHaveLength(1);
  });
});
