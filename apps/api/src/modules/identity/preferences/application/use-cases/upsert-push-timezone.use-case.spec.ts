import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";

import { GetPreferenceUseCase } from "./get-preference.use-case.js";
import { UpsertPushTimezoneUseCase } from "./upsert-push-timezone.use-case.js";

describe("UpsertPushTimezone — 토큰 등록의 timezone 동기화", () => {
  it.each([true, false])(
    "설정 행 존재=%s: timezone을 저장하고 캐시된 이전 응답을 갱신한다",
    async (existing) => {
      // Given
      const fixture = createUserSettingsFixture(
        existing ? { preference: { currentStreak: 7 } } : { preference: null },
      );
      const query = new GetPreferenceUseCase(fixture);
      expect((await query.execute({ userId: fixture.userId })).timezone).toBe("UTC");
      fixture.reminderTimezoneCache.activeTimezones.add("UTC");
      // When
      await new UpsertPushTimezoneUseCase(fixture).execute({
        userId: fixture.userId,
        timezone: "America/New_York",
      });
      // Then
      expect((await query.execute({ userId: fixture.userId })).timezone).toBe("America/New_York");
      expect(fixture.preferenceRepository.stored(fixture.userId)?.timezone).toBe(
        "America/New_York",
      );
      expect(fixture.reminderTimezoneCache.activeTimezones.size).toBe(0);
      expect(fixture.reminderEnqueuer.jobs).toEqual([]);
      expect(fixture.todoTimezoneRebase.enqueued).toEqual([fixture.userId]);
      if (existing) {
        expect(fixture.preferenceRepository.stored(fixture.userId)?.currentStreak).toBe(7);
      }
    },
  );
  it("같은 시간대를 다시 보고하면 재계산 작업을 등록하지 않는다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ preference: { timezone: "Asia/Seoul" } });
    // When
    await new UpsertPushTimezoneUseCase(fixture).execute({
      userId: fixture.userId,
      timezone: "Asia/Seoul",
    });
    // Then
    expect(fixture.todoTimezoneRebase.enqueued).toEqual([]);
  });
  it("활성 timezone 캐시 삭제 실패를 전달하며 이미 저장된 설정을 되돌리지 않는다", async () => {
    // Given: 이전 설정 응답이 캐시되어 있고 목록 무효화가 실패한다.
    const fixture = createUserSettingsFixture();
    await fixture.preferenceReader.read(UserId.reconstitute(fixture.userId));
    const failure = new Error("synthetic cache unavailable");
    const useCase = new UpsertPushTimezoneUseCase({
      ...fixture,
      reminderTimezoneCache: {
        invalidateActiveTimezones: async () => {
          throw failure;
        },
      },
    });
    // When/Then: 기존 실패를 전달하고 이미 저장된 변경·설정 캐시 갱신은 유지한다.
    await expect(
      useCase.execute({
        userId: fixture.userId,
        timezone: "Asia/Seoul",
      }),
    ).rejects.toBe(failure);
    expect(fixture.preferenceRepository.stored(fixture.userId)).toMatchObject({
      timezone: "Asia/Seoul",
    });
    expect(fixture.cache.snapshots.has(fixture.userId)).toBe(false);
    expect(fixture.reminderEnqueuer.jobs).toEqual([]);
  });
});
