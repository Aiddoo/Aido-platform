import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";

import { GetPreference } from "./get-preference.use-case.js";
import { RefreshPushTimezone } from "./refresh-push-timezone.use-case.js";

describe("RefreshPushTimezone — 실제 변경에만 설정 캐시 갱신", () => {
  it("캐시된 UTC를 새 timezone으로 갱신해 이후 설정 조회와 DB가 일치한다", async () => {
    // Given
    const fixture = createUserSettingsFixture();
    const query = new GetPreference(fixture);
    expect((await query.execute({ userId: fixture.userId })).timezone).toBe("UTC");
    fixture.cache.activeTimezones.add("UTC");
    // When
    await new RefreshPushTimezone(fixture).execute({
      userId: fixture.userId,
      timezone: "Asia/Seoul",
    });
    const reloaded = await query.execute({ userId: fixture.userId });
    // Then
    expect(reloaded.timezone).toBe("Asia/Seoul");
    expect(fixture.preferenceRepository.records.get(fixture.userId)?.timezone).toBe("Asia/Seoul");
    expect(fixture.cache.activeTimezones.size).toBe(0);
    expect(fixture.cache.activeTimezoneInvalidations).toBe(1);
  });
  it.each([true, false])(
    "설정 행 존재=%s: 변경이 없으면 행 생성과 캐시 무효화를 하지 않는다",
    async (existing) => {
      // Given
      const fixture = createUserSettingsFixture(existing ? {} : { preference: null });
      await fixture.preferenceReader.read(fixture.userId);
      const cached = fixture.cache.snapshots.get(fixture.userId);
      fixture.cache.activeTimezones.add("UTC");
      // When
      await new RefreshPushTimezone(fixture).execute({ userId: fixture.userId, timezone: "UTC" });
      // Then
      expect(fixture.preferenceRepository.records.size).toBe(existing ? 1 : 0);
      expect(fixture.cache.snapshots.get(fixture.userId)).toEqual(cached);
      expect([...fixture.cache.activeTimezones]).toEqual(["UTC"]);
      expect(fixture.cache.activeTimezoneInvalidations).toBe(0);
    },
  );
});
