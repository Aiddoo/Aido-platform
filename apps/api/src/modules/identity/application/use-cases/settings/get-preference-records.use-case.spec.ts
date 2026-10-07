import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { GetPreferenceRecords } from "./get-preference-records.use-case.js";

describe("GetPreferenceRecords — 알림 발송 대상의 설정 배치 조회", () => {
  it("단건 반복 없이 요청한 사용자만 조회하고 누락 행·순서와 무관하게 ID로 결과를 구분한다", async () => {
    // Given
    const fixture = createUserSettingsFixture();
    fixture.preferenceRepository.records.set("other-user", {
      ...fixture.preference,
      locale: "ja",
      currentStreak: 7,
      lastCompletedDate: SETTINGS_TIME,
    });
    fixture.preferenceRepository.records.set("excluded-user", fixture.preference);
    // When
    const records = await new GetPreferenceRecords(fixture).execute({
      userIds: ["other-user", "missing-user", fixture.userId],
    });
    // Then
    const byUserId = new Map(records.map((record) => [record.userId, record]));
    expect([...byUserId.keys()].sort()).toEqual(["other-user", fixture.userId].sort());
    expect(byUserId.get("other-user")).toMatchObject({
      locale: "ja",
      currentStreak: 7,
      lastCompletedDate: SETTINGS_TIME,
    });
    expect(byUserId.get(fixture.userId)?.lastCompletedDate).toBeNull();
    expect(fixture.preferenceRepository.batchReads).toHaveLength(1);
    expect(fixture.preferenceRepository.reads).toEqual([]);
  });
});
