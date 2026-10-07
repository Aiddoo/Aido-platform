import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { GetPreference } from "./get-preference.use-case.js";
import { UpdatePreference } from "./update-preference.use-case.js";

describe("UpdatePreference — 부분 수정과 리마인더 즉시 반영", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SETTINGS_TIME);
  });
  afterEach(() => vi.useRealTimers());
  it("false·0을 저장하고 미지정 필드·streak를 보존하며 캐시를 갱신한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({
      preference: {
        pushEnabled: true,
        nightPushEnabled: true,
        weatherMorningMinute: 37,
        currentStreak: 3,
        longestStreak: 9,
        lastCompletedDate: SETTINGS_TIME,
      },
    });
    const query = new GetPreference(fixture);
    await query.execute({ userId: fixture.userId });
    fixture.reminderTimezoneCache.activeTimezones.add("UTC");
    // When
    const result = await new UpdatePreference(fixture).execute({
      userId: fixture.userId,
      pushEnabled: false,
      weatherMorningMinute: 0,
      nightPushEnabled: undefined,
    });
    const reloaded = await query.execute({ userId: fixture.userId });
    // Then
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toEqual({
      ...fixture.preference,
      pushEnabled: false,
      weatherMorningMinute: 0,
    });
    expect(result).toMatchObject({
      pushEnabled: false,
      nightPushEnabled: true,
      weatherMorningMinute: 0,
    });
    expect(reloaded).toMatchObject({ pushEnabled: false, weatherMorningMinute: 0 });
    expect(fixture.reminderTimezoneCache.activeTimezones.size).toBe(0);
    expect(fixture.reminderEnqueuer.jobs).toEqual([]);
  });
  it("프리미엄 변경은 최신 저장 타임존으로 잡을 등록하고 지정한 리마인더 필드만 바꾼다", async () => {
    // Given
    const fixture = createUserSettingsFixture({
      premium: true,
      preference: { timezone: "Asia/Seoul", eveningReminderHour: 20 },
    });
    await fixture.preferenceReader.read(fixture.userId);
    // When
    const result = await new UpdatePreference(fixture).execute({
      userId: fixture.userId,
      morningReminderHour: 7,
      morningReminderMinute: 0,
    });
    // Then
    expect(result).toMatchObject({
      morningReminderHour: 7,
      morningReminderMinute: 0,
      eveningReminderHour: 20,
    });
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toEqual({
      ...fixture.preference,
      morningReminderHour: 7,
      morningReminderMinute: 0,
    });
    expect(fixture.cache.snapshots.has(fixture.userId)).toBe(false);
    expect(fixture.reminderEnqueuer.jobs).toEqual([
      {
        userId: fixture.userId,
        timezone: "Asia/Seoul",
        morningReminderHour: 7,
        morningReminderMinute: 0,
        eveningReminderHour: undefined,
        eveningReminderMinute: undefined,
      },
    ]);
  });
  it("설정 행이 없는 기존 사용자도 첫 weather 수정에서 여섯 입력을 모두 저장한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ preference: null });
    const changes = {
      weatherMorningEnabled: false,
      weatherMorningHour: 9,
      weatherMorningMinute: 37,
      weatherEveningEnabled: false,
      weatherEveningHour: 22,
      weatherEveningMinute: 43,
    };
    // When
    const result = await new UpdatePreference(fixture).execute({
      userId: fixture.userId,
      ...changes,
    });
    // Then
    expect(result).toMatchObject(changes);
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toMatchObject(changes);
    expect(fixture.reminderEnqueuer.jobs).toEqual([]);
  });
  it.each([
    {
      description: "무료 리마인더 변경",
      premium: false,
      changes: { morningReminderHour: 13 },
      errorCode: ErrorCode.PREFERENCE_1701,
    },
    {
      description: "프리미엄의 범위 밖 아침",
      premium: true,
      changes: { morningReminderHour: 13 },
      errorCode: ErrorCode.PREFERENCE_1702,
    },
    {
      description: "프리미엄의 범위 밖 저녁",
      premium: true,
      changes: { eveningReminderHour: 11 },
      errorCode: ErrorCode.PREFERENCE_1702,
    },
    {
      description: "무효한 timezone",
      premium: false,
      changes: { timezone: "Invalid/Timezone" },
      errorCode: ErrorCode.SYS_0002,
    },
  ])(
    "$description: 오류 우선순위를 유지하고 저장·캐시·잡을 변경하지 않는다",
    async ({ premium, changes, errorCode }) => {
      // Given
      const fixture = createUserSettingsFixture({ premium });
      await fixture.preferenceReader.read(fixture.userId);
      const snapshot = fixture.cache.snapshots.get(fixture.userId);
      // When
      const pending = new UpdatePreference(fixture).execute({ userId: fixture.userId, ...changes });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode });
      expect(fixture.preferenceRepository.records.get(fixture.userId)).toEqual(fixture.preference);
      expect(fixture.cache.snapshots.get(fixture.userId)).toEqual(snapshot);
      expect(fixture.reminderEnqueuer.jobs).toEqual([]);
    },
  );
  it("IANA 별칭은 정규 timezone으로 저장하고 새 응답에 반영한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ preference: { timezone: "Asia/Seoul" } });
    const query = new GetPreference(fixture);
    await query.execute({ userId: fixture.userId });
    // When
    await new UpdatePreference(fixture).execute({ userId: fixture.userId, timezone: "Etc/UTC" });
    // Then
    expect(fixture.preferenceRepository.records.get(fixture.userId)?.timezone).toBe("UTC");
    expect((await query.execute({ userId: fixture.userId })).timezone).toBe("UTC");
  });
  it("활성 timezone 캐시 삭제 실패를 전달하며 이미 저장된 설정을 되돌리지 않는다", async () => {
    // Given: 이전 설정 응답이 캐시되어 있고 목록 무효화가 실패한다.
    const fixture = createUserSettingsFixture();
    await fixture.preferenceReader.read(fixture.userId);
    const failure = new Error("synthetic cache unavailable");
    vi.spyOn(fixture.reminderTimezoneCache, "invalidateActiveTimezones").mockRejectedValueOnce(
      failure,
    );
    // When/Then: 기존 실패를 전달하고 이미 저장된 변경·설정 캐시 갱신은 유지한다.
    await expect(
      new UpdatePreference(fixture).execute({ userId: fixture.userId, pushEnabled: false }),
    ).rejects.toBe(failure);
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toMatchObject({
      pushEnabled: false,
    });
    expect(fixture.cache.snapshots.has(fixture.userId)).toBe(false);
    expect(fixture.reminderEnqueuer.jobs).toEqual([]);
  });
  it("timezone 목록 무효화가 완료될 때까지 응답과 완료 로그를 기다린다", async () => {
    // Given: 새 timezone은 저장할 수 있지만 캐시 삭제가 아직 완료되지 않았다.
    const fixture = createUserSettingsFixture();
    const entered = Promise.withResolvers<void>();
    const deletion = Promise.withResolvers<void>();
    vi.spyOn(fixture.reminderTimezoneCache, "invalidateActiveTimezones").mockImplementation(() => {
      entered.resolve();
      return deletion.promise;
    });
    // When: 저장 흐름이 목록 삭제에 도달한다.
    const execution = new UpdatePreference(fixture).execute({
      userId: fixture.userId,
      timezone: "Asia/Seoul",
    });
    try {
      await entered.promise;
      // Then: 캐시 삭제 전 완료 로그를 남기지 않고, 삭제 완료 뒤 응답한다.
      expect(fixture.logger.log).not.toHaveBeenCalled();
      deletion.resolve();
      await expect(execution).resolves.toMatchObject({ timezone: "Asia/Seoul" });
      expect(fixture.logger.log).toHaveBeenCalledTimes(1);
    } finally {
      deletion.resolve();
      await execution;
    }
  });
});
