import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createUserSettingsFixture } from "#test/fixtures/identity/user-settings-scenario.fixture";

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
  it.each([
    { stored: "Asia/Seoul", reported: "Asia/Seoul" },
    { stored: "Asia/Calcutta", reported: "Asia/Kolkata" },
    { stored: "Europe/Kiev", reported: "Europe/Kyiv" },
  ])(
    "$stored 저장값에 같은 시간대 $reported를 보고하면 쓰지 않고 재계산 작업을 등록하지 않는다",
    async ({ stored, reported }) => {
      // Given
      const fixture = createUserSettingsFixture({ preference: { timezone: stored } });
      // When
      await new UpsertPushTimezoneUseCase(fixture).execute({
        userId: fixture.userId,
        timezone: reported,
      });
      // Then
      expect(fixture.preferenceRepository.stored(fixture.userId)?.timezone).toBe(stored);
      expect(fixture.todoTimezoneRebase.enqueued).toEqual([]);
    },
  );
  it("활성 timezone 캐시 삭제 실패를 전달하며 이미 저장된 설정을 되돌리지 않는다", async () => {
    // Given
    // 이전 설정 응답이 캐시되어 있고 목록 무효화가 실패한다.
    const fixture = createUserSettingsFixture();
    await fixture.preferenceReader.execute(UserId.reconstitute(fixture.userId));
    const failure = new Error("synthetic cache unavailable");
    const useCase = new UpsertPushTimezoneUseCase({
      ...fixture,
      reminderTimezoneCache: {
        invalidateActiveTimezones: async () => {
          throw failure;
        },
      },
    });

    // When
    const result = useCase.execute({
      userId: fixture.userId,
      timezone: "Asia/Seoul",
    });

    // Then
    await expect(result).rejects.toBe(failure);
    expect(fixture.preferenceRepository.stored(fixture.userId)).toMatchObject({
      timezone: "Asia/Seoul",
    });
    expect(fixture.cache.snapshots.has(fixture.userId)).toBe(false);
    expect(fixture.reminderEnqueuer.jobs).toEqual([]);
  });
});
