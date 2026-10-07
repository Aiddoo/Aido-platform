import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";

import { GetPreference } from "./get-preference.use-case.js";
import { UpsertPushTimezone } from "./upsert-push-timezone.use-case.js";

describe("UpsertPushTimezone — 토큰 등록의 timezone 동기화", () => {
  it.each([true, false])(
    "설정 행 존재=%s: timezone을 저장하고 캐시된 이전 응답을 갱신한다",
    async (existing) => {
      // Given
      const fixture = createUserSettingsFixture(
        existing ? { preference: { currentStreak: 7 } } : { preference: null },
      );
      const query = new GetPreference(fixture);
      expect((await query.execute({ userId: fixture.userId })).timezone).toBe("UTC");
      fixture.cache.activeTimezones.add("UTC");
      // When
      await new UpsertPushTimezone(fixture).execute({
        userId: fixture.userId,
        timezone: "America/New_York",
      });
      // Then
      expect((await query.execute({ userId: fixture.userId })).timezone).toBe("America/New_York");
      expect(fixture.preferenceRepository.records.get(fixture.userId)?.timezone).toBe(
        "America/New_York",
      );
      expect(fixture.cache.activeTimezones.size).toBe(0);
      expect(fixture.reminderEnqueuer.jobs).toEqual([]);
      if (existing)
        expect(fixture.preferenceRepository.records.get(fixture.userId)?.currentStreak).toBe(7);
    },
  );
});
