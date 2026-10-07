import { vi } from "vitest";

import { createUserSettingsFixture, SETTINGS_TIME } from "#test/fixtures/user-settings.fixture";

import { IdentitySettingsLogEvent } from "../../observability/settings/identity-settings-log.events.js";
import { OnTodoToggled } from "./on-todo-toggled.use-case.js";

const today = new Date("2026-01-16T00:00:00.000Z");
const yesterday = new Date("2026-01-15T00:00:00.000Z");

describe("OnTodoToggled — 최신 완료 현황과 streak CAS", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SETTINGS_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function given() {
    const fixture = createUserSettingsFixture({
      preference: { currentStreak: 2, longestStreak: 5, lastCompletedDate: yesterday },
    });
    fixture.statsReader.days.set(`${fixture.userId}/2026-01-16`, { total: 2, completed: 2 });
    return { ...fixture, useCase: new OnTodoToggled(fixture) };
  }

  it("전체 완료를 한 번 반영하고 같은 날 재요청에도 3일 마일스톤은 한 번만 등록한다", async () => {
    // Given
    const fixture = given();
    const input = { userId: fixture.userId, completed: true, timezone: "Asia/Seoul" };
    // When
    await fixture.useCase.execute(input);
    await fixture.useCase.execute(input);
    // Then
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toMatchObject({
      currentStreak: 3,
      longestStreak: 5,
      lastCompletedDate: today,
    });
    expect(fixture.milestoneNotifier.userIds).toEqual([fixture.userId]);
    expect(fixture.preferenceRepository.streakAttempts).toHaveLength(1);
  });
  it("동시에 읽은 같은 streak는 CAS 성공 요청만 상태와 마일스톤을 반영한다", async () => {
    // Given
    const fixture = given();
    const input = { userId: fixture.userId, completed: true };
    // When
    const outcomes = await Promise.allSettled([
      fixture.useCase.execute(input),
      fixture.useCase.execute(input),
    ]);
    // Then
    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toMatchObject({
      currentStreak: 3,
      longestStreak: 5,
      lastCompletedDate: today,
    });
    expect(fixture.milestoneNotifier.userIds).toEqual([fixture.userId]);
    expect(fixture.preferenceRepository.streakAttempts).toHaveLength(2);
  });
  it.each([
    { description: "오늘 할 일이 없는", stats: { total: 0, completed: 0 }, missing: false },
    { description: "일부만 완료한", stats: { total: 2, completed: 1 }, missing: false },
    { description: "설정 행이 없는", stats: { total: 2, completed: 2 }, missing: true },
  ])(
    "$description 사용자에게는 streak·마일스톤을 새로 반영하지 않는다",
    async ({ stats, missing }) => {
      // Given
      const fixture = given();
      fixture.statsReader.days.set(`${fixture.userId}/2026-01-16`, stats);
      if (missing) fixture.preferenceRepository.records.delete(fixture.userId);
      // When
      await fixture.useCase.execute({ userId: fixture.userId, completed: true });
      // Then
      expect(fixture.preferenceRepository.records.get(fixture.userId)).toEqual(
        missing ? undefined : fixture.preference,
      );
      expect(fixture.preferenceRepository.streakAttempts).toEqual([]);
      expect(fixture.milestoneNotifier.userIds).toEqual([]);
    },
  );
  it("지연된 완료 취소 이벤트도 현재 모든 할 일이 완료되어 있으면 streak를 증가시킨다", async () => {
    // Given
    const fixture = given();
    // When
    await fixture.useCase.execute({ userId: fixture.userId, completed: false });
    // Then
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toMatchObject({
      currentStreak: 3,
      lastCompletedDate: today,
    });
    expect(fixture.milestoneNotifier.userIds).toEqual([fixture.userId]);
  });
  it.each([true, false])(
    "어제 전체 완료=%s: 지연된 완료 이벤트도 최신 미완료 현황에 따라 오늘 반영을 취소한다",
    async (hadYesterdayCompletion) => {
      // Given
      const fixture = given();
      fixture.preferenceRepository.records.set(fixture.userId, {
        ...fixture.preference,
        currentStreak: 3,
        longestStreak: 9,
        lastCompletedDate: today,
      });
      fixture.statsReader.days.set(`${fixture.userId}/2026-01-16`, { total: 2, completed: 1 });
      fixture.statsReader.days.set(`${fixture.userId}/2026-01-15`, {
        total: hadYesterdayCompletion ? 1 : 0,
        completed: hadYesterdayCompletion ? 1 : 0,
      });
      // When
      await fixture.useCase.execute({ userId: fixture.userId, completed: true });
      // Then
      expect(fixture.preferenceRepository.records.get(fixture.userId)).toMatchObject({
        currentStreak: hadYesterdayCompletion ? 2 : 0,
        longestStreak: 9,
        lastCompletedDate: hadYesterdayCompletion ? yesterday : null,
      });
      expect(fixture.milestoneNotifier.userIds).toEqual([]);
      expect(fixture.statsReader.queries.map((query) => query.dayStart)).toEqual([
        today,
        yesterday,
      ]);
    },
  );
  it("CAS 충돌 후 최신 완료 현황을 다시 읽고 처리 중 자정을 지나도 처음 선택한 날짜를 유지한다", async () => {
    // Given
    const fixture = given();
    vi.spyOn(fixture.preferenceRepository, "updateStreakIfUnchanged").mockImplementationOnce(
      async () => {
        fixture.statsReader.days.set(`${fixture.userId}/2026-01-16`, { total: 2, completed: 1 });
        vi.setSystemTime(SETTINGS_TIME.getTime() + 86_400_000);
        return false;
      },
    );
    // When
    await fixture.useCase.execute({ userId: fixture.userId, completed: true });
    // Then
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toEqual(fixture.preference);
    expect(fixture.statsReader.queries.map((query) => query.dayStart)).toEqual([today, today]);
    expect(fixture.milestoneNotifier.userIds).toEqual([]);
  });
  it("CAS 충돌 후 다른 요청이 반영한 최신 상태를 읽으면 덮어쓰거나 마일스톤을 재등록하지 않는다", async () => {
    // Given
    const fixture = given();
    vi.spyOn(fixture.preferenceRepository, "updateStreakIfUnchanged").mockImplementationOnce(
      async () => {
        fixture.preferenceRepository.records.set(fixture.userId, {
          ...fixture.preference,
          currentStreak: 7,
          longestStreak: 9,
          lastCompletedDate: today,
        });
        return false;
      },
    );
    // When
    await fixture.useCase.execute({ userId: fixture.userId, completed: true });
    // Then
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toMatchObject({
      currentStreak: 7,
      longestStreak: 9,
      lastCompletedDate: today,
    });
    expect(fixture.milestoneNotifier.userIds).toEqual([]);
    expect(fixture.preferenceRepository.reads).toHaveLength(2);
  });
  it("지속적인 충돌은 세 번까지만 재시도하고 Todo 처리 실패로 전파하지 않는다", async () => {
    // Given
    const fixture = given();
    const compareAndSet = vi
      .spyOn(fixture.preferenceRepository, "updateStreakIfUnchanged")
      .mockResolvedValue(false);
    // When
    await expect(
      fixture.useCase.execute({ userId: fixture.userId, completed: true }),
    ).resolves.toBeUndefined();
    // Then
    expect(compareAndSet).toHaveBeenCalledTimes(3);
    expect(fixture.statsReader.queries).toHaveLength(3);
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toEqual(fixture.preference);
    expect(fixture.milestoneNotifier.userIds).toEqual([]);
    expect(fixture.logger.warn).toHaveBeenCalledWith({
      event: IdentitySettingsLogEvent.STREAK_UPDATE_CONFLICT,
      userId: fixture.userId,
      attempts: 3,
    });
  });
  it("조회 실패는 격리하고 원래 오류 메시지·stack을 로그에 넣지 않는다", async () => {
    // Given
    const fixture = given();
    vi.spyOn(fixture.statsReader, "countForDay").mockRejectedValueOnce(
      new Error("민감한 요청 원문"),
    );
    // When
    await expect(
      fixture.useCase.execute({ userId: fixture.userId, completed: true }),
    ).resolves.toBeUndefined();
    // Then
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toEqual(fixture.preference);
    expect(fixture.milestoneNotifier.userIds).toEqual([]);
    expect(fixture.logger.error).toHaveBeenCalledWith({
      event: IdentitySettingsLogEvent.STREAK_UPDATE_FAILED,
      userId: fixture.userId,
      errorName: "Error",
    });
    expect(JSON.stringify(fixture.logger.error.mock.calls)).not.toContain("민감한 요청 원문");
  });
  it.each([
    {
      description: "뉴욕 자정 직전",
      at: "2026-03-08T04:59:59.999Z",
      timezone: "America/New_York",
      date: "2026-03-07",
    },
    {
      description: "뉴욕 자정",
      at: "2026-03-08T05:00:00.000Z",
      timezone: "America/New_York",
      date: "2026-03-08",
    },
    {
      description: "서울 연도 경계",
      at: "2026-12-31T15:00:00.000Z",
      timezone: "Asia/Seoul",
      date: "2027-01-01",
    },
    {
      description: "기본 UTC",
      at: "2026-12-31T15:00:00.000Z",
      timezone: undefined,
      date: "2026-12-31",
    },
  ])("$description: 로컬 달력 날짜를 DATE 구간으로 선택한다", async ({ at, timezone, date }) => {
    // Given
    vi.setSystemTime(new Date(at));
    const fixture = createUserSettingsFixture();
    fixture.statsReader.days.set(`${fixture.userId}/${date}`, { total: 1, completed: 1 });
    // When
    await new OnTodoToggled(fixture).execute({ userId: fixture.userId, completed: true, timezone });
    // Then
    const expectedDay = new Date(`${date}T00:00:00.000Z`);
    expect(fixture.preferenceRepository.records.get(fixture.userId)?.lastCompletedDate).toEqual(
      expectedDay,
    );
    expect(fixture.statsReader.queries).toEqual([
      {
        userId: fixture.userId,
        dayStart: expectedDay,
        dayEnd: new Date(expectedDay.getTime() + 86_400_000),
      },
    ]);
  });
  it.each([
    {
      description: "봄 DST의 사라진 시간",
      first: "2026-03-08T06:30:00.000Z",
      next: "2026-03-08T07:30:00.000Z",
      date: "2026-03-08",
      prior: "2026-03-07",
    },
    {
      description: "가을 DST의 반복된 시간",
      first: "2026-11-01T05:30:00.000Z",
      next: "2026-11-01T06:30:00.000Z",
      date: "2026-11-01",
      prior: "2026-10-31",
    },
  ])(
    "$description: 같은 달력 날짜의 streak와 마일스톤은 한 번만 반영한다",
    async ({ first, next, date, prior }) => {
      // Given
      const fixture = createUserSettingsFixture({
        preference: {
          currentStreak: 2,
          longestStreak: 5,
          lastCompletedDate: new Date(`${prior}T00:00:00.000Z`),
        },
      });
      fixture.statsReader.days.set(`${fixture.userId}/${date}`, { total: 1, completed: 1 });
      const useCase = new OnTodoToggled(fixture);
      const input = { userId: fixture.userId, completed: true, timezone: "America/New_York" };
      // When
      vi.setSystemTime(new Date(first));
      await useCase.execute(input);
      vi.setSystemTime(new Date(next));
      await useCase.execute(input);
      // Then
      expect(fixture.preferenceRepository.records.get(fixture.userId)).toMatchObject({
        currentStreak: 3,
        longestStreak: 5,
        lastCompletedDate: new Date(`${date}T00:00:00.000Z`),
      });
      expect(fixture.milestoneNotifier.userIds).toEqual([fixture.userId]);
      expect(fixture.preferenceRepository.streakAttempts).toHaveLength(1);
    },
  );
});
