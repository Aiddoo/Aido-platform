import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";

import { GetPreferenceUseCase } from "./get-preference.use-case.js";
import { RefreshPushTimezoneUseCase } from "./refresh-push-timezone.use-case.js";

describe("RefreshPushTimezone — 실제 변경에만 설정 캐시 갱신", () => {
  it("캐시된 UTC를 새 timezone으로 갱신해 이후 설정 조회와 DB가 일치한다", async () => {
    // Given
    const fixture = createUserSettingsFixture();
    const query = new GetPreferenceUseCase(fixture);
    expect((await query.execute({ userId: fixture.userId })).timezone).toBe("UTC");
    fixture.reminderTimezoneCache.activeTimezones.add("UTC");
    // When
    await new RefreshPushTimezoneUseCase(fixture).execute({
      userId: fixture.userId,
      timezone: "Asia/Seoul",
    });
    const reloaded = await query.execute({ userId: fixture.userId });
    // Then
    expect(reloaded.timezone).toBe("Asia/Seoul");
    expect(fixture.preferenceRepository.stored(fixture.userId)?.timezone).toBe("Asia/Seoul");
    expect(fixture.reminderTimezoneCache.activeTimezones.size).toBe(0);
    expect(fixture.reminderTimezoneCache.activeTimezoneInvalidations).toBe(1);
    expect(fixture.todoTimezoneRebase.enqueued).toEqual([fixture.userId]);
  });
  it.each([true, false])(
    "설정 행 존재=%s: 변경이 없으면 행 생성과 캐시 무효화를 하지 않는다",
    async (existing) => {
      // Given
      const fixture = createUserSettingsFixture(existing ? {} : { preference: null });
      await fixture.preferenceReader.read(UserId.reconstitute(fixture.userId));
      const cached = fixture.cache.snapshots.get(fixture.userId);
      fixture.reminderTimezoneCache.activeTimezones.add("UTC");
      // When
      await new RefreshPushTimezoneUseCase(fixture).execute({
        userId: fixture.userId,
        timezone: "UTC",
      });
      // Then
      expect(fixture.preferenceRepository.all).toHaveLength(existing ? 1 : 0);
      expect(fixture.cache.snapshots.get(fixture.userId)).toEqual(cached);
      expect([...fixture.reminderTimezoneCache.activeTimezones]).toEqual(["UTC"]);
      expect(fixture.reminderTimezoneCache.activeTimezoneInvalidations).toBe(0);
      expect(fixture.todoTimezoneRebase.enqueued).toEqual([]);
    },
  );
  it("재계산 작업을 등록하지 못하면 예외를 던져 다음 요청이 다시 시도하게 한다", async () => {
    // Given
    const fixture = createUserSettingsFixture();
    const failure = new Error("queue unavailable");
    const useCase = new RefreshPushTimezoneUseCase({
      ...fixture,
      todoTimezoneRebase: {
        enqueueRebase: async () => {
          throw failure;
        },
      },
    });
    // When
    const refresh = useCase.execute({
      userId: fixture.userId,
      timezone: "Asia/Seoul",
    });
    // Then
    await expect(refresh).rejects.toBe(failure);
  });
  it("활성 timezone 캐시 삭제 실패를 전달하며 이미 저장된 설정을 되돌리지 않는다", async () => {
    // Given: 이전 설정 응답이 캐시되어 있고 목록 무효화가 실패한다.
    const fixture = createUserSettingsFixture();
    await fixture.preferenceReader.read(UserId.reconstitute(fixture.userId));
    const failure = new Error("synthetic cache unavailable");
    const useCase = new RefreshPushTimezoneUseCase({
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
