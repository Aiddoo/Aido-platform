import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { GetPreferenceRecord } from "./get-preference-record.use-case.js";

describe("GetPreferenceRecord — 다른 컨텍스트가 읽는 저장 설정", () => {
  it("저장된 리마인더·streak를 프리미엄 게이팅 없이 제공하고 다른 사용자의 행은 반환하지 않는다", async () => {
    // Given
    const fixture = createUserSettingsFixture({
      preference: {
        morningReminderHour: 7,
        currentStreak: 3,
        longestStreak: 9,
        lastCompletedDate: SETTINGS_TIME,
      },
    });
    const useCase = new GetPreferenceRecord(fixture);
    // When
    const record = await useCase.execute({ userId: fixture.userId });
    const missing = await useCase.execute({ userId: "other-user" });
    // Then
    expect(record).toMatchObject({
      morningReminderHour: 7,
      currentStreak: 3,
      longestStreak: 9,
      lastCompletedDate: SETTINGS_TIME,
    });
    expect(missing).toBeNull();
  });
});
