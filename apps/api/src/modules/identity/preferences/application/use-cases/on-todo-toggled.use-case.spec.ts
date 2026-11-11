import type { StreakState } from "#api/modules/identity/preferences/domain/streak.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryUserPreferenceRepository } from "#test/doubles/identity/in-memory-user-preference.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";

import { TodoCompletionStatsReaderPort } from "../ports/todo-completion-stats.reader.port.js";
import { PreferenceLogEvent } from "../preferences.log-events.js";
import { OnTodoToggledUseCase } from "./on-todo-toggled.use-case.js";

const today = Temporal.PlainDate.from("2026-01-16");
const yesterday = Temporal.PlainDate.from("2026-01-15");

interface ConcurrentStreakChange {
  /** 다른 요청이 먼저 커밋한 연속 완료 상태. 없으면 상태는 그대로 두고 CAS만 진다 */
  readonly committed?: StreakState;
  readonly meanwhile?: () => void;
}

// 다른 요청이 먼저 커밋한 것처럼 다음 CAS를 지게 하고, 그 사이에 일어난 일을 흉내 낸다
class ContendedPreferenceRepository extends InMemoryUserPreferenceRepository {
  compareAndSetAttempts = 0;
  readonly #conflicts: ConcurrentStreakChange[] = [];

  conflictOnNext(...changes: ConcurrentStreakChange[]): void {
    this.#conflicts.push(...changes);
  }

  override async updateStreakIfUnchanged(
    userId: UserId,
    expected: StreakState,
    next: StreakState,
  ): Promise<boolean> {
    this.compareAndSetAttempts += 1;
    const conflict = this.#conflicts.shift();
    if (conflict == null) {
      return super.updateStreakIfUnchanged(userId, expected, next);
    }
    conflict.meanwhile?.();
    if (conflict.committed != null) {
      await super.updateStreakIfUnchanged(userId, expected, conflict.committed);
    }
    return false;
  }
}

class FailingStatsReader extends TodoCompletionStatsReaderPort {
  async countForDay(): Promise<never> {
    throw new Error("민감한 요청 원문");
  }
}

describe("OnTodoToggled — 최신 완료 현황과 streak CAS", () => {
  function given() {
    const fixture = createUserSettingsFixture({
      preference: { currentStreak: 2, longestStreak: 5, lastCompletedDate: yesterday },
    });
    fixture.statsReader.days.set(`${fixture.userId}/2026-01-16`, { total: 2, completed: 2 });
    return { ...fixture, useCase: new OnTodoToggledUseCase(fixture) };
  }

  function givenContended() {
    const fixture = given();
    const preferenceRepository = new ContendedPreferenceRepository(
      fixture.preferenceRepository.all,
    );
    return {
      ...fixture,
      preferenceRepository,
      useCase: new OnTodoToggledUseCase({ ...fixture, preferenceRepository }),
    };
  }

  it("전체 완료를 한 번 반영하고 같은 날 재요청에도 3일 마일스톤은 한 번만 등록한다", async () => {
    // Given
    const fixture = given();
    const input = { userId: fixture.userId, completed: true, timezone: "Asia/Seoul" };
    // When
    await fixture.useCase.execute(input);
    await fixture.useCase.execute(input);
    // Then
    expect(fixture.preferenceRepository.stored(fixture.userId)).toMatchObject({
      currentStreak: 3,
      longestStreak: 5,
      lastCompletedDate: today,
    });
    expect(fixture.milestoneNotifier.userIds).toEqual([fixture.userId]);
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
    expect(fixture.preferenceRepository.stored(fixture.userId)).toMatchObject({
      currentStreak: 3,
      longestStreak: 5,
      lastCompletedDate: today,
    });
    expect(fixture.milestoneNotifier.userIds).toEqual([fixture.userId]);
  });
  it.each([
    { description: "오늘 할 일이 없는", stats: { total: 0, completed: 0 }, missing: false },
    { description: "일부만 완료한", stats: { total: 2, completed: 1 }, missing: false },
    { description: "설정 행이 없는", stats: { total: 2, completed: 2 }, missing: true },
  ])(
    "$description 사용자에게는 streak·마일스톤을 새로 반영하지 않는다",
    async ({ stats, missing }) => {
      // Given
      const fixture = createUserSettingsFixture({
        preference: missing
          ? null
          : { currentStreak: 2, longestStreak: 5, lastCompletedDate: yesterday },
      });
      fixture.statsReader.days.set(`${fixture.userId}/2026-01-16`, stats);
      // When
      await new OnTodoToggledUseCase(fixture).execute({ userId: fixture.userId, completed: true });
      // Then
      expect(fixture.preferenceRepository.stored(fixture.userId)).toEqual(
        missing ? undefined : fixture.preference,
      );
      expect(fixture.milestoneNotifier.userIds).toEqual([]);
    },
  );
  it("지연된 완료 취소 이벤트도 현재 모든 할 일이 완료되어 있으면 streak를 증가시킨다", async () => {
    // Given
    const fixture = given();
    // When
    await fixture.useCase.execute({ userId: fixture.userId, completed: false });
    // Then
    expect(fixture.preferenceRepository.stored(fixture.userId)).toMatchObject({
      currentStreak: 3,
      lastCompletedDate: today,
    });
    expect(fixture.milestoneNotifier.userIds).toEqual([fixture.userId]);
  });
  it.each([true, false])(
    "어제 전체 완료=%s: 지연된 완료 이벤트도 최신 미완료 현황에 따라 오늘 반영을 취소한다",
    async (hadYesterdayCompletion) => {
      // Given
      const fixture = createUserSettingsFixture({
        preference: { currentStreak: 3, longestStreak: 9, lastCompletedDate: today },
      });
      fixture.statsReader.days.set(`${fixture.userId}/2026-01-16`, { total: 2, completed: 1 });
      fixture.statsReader.days.set(`${fixture.userId}/2026-01-15`, {
        total: hadYesterdayCompletion ? 1 : 0,
        completed: hadYesterdayCompletion ? 1 : 0,
      });
      // When
      await new OnTodoToggledUseCase(fixture).execute({ userId: fixture.userId, completed: true });
      // Then
      expect(fixture.preferenceRepository.stored(fixture.userId)).toMatchObject({
        currentStreak: hadYesterdayCompletion ? 2 : 0,
        longestStreak: 9,
        lastCompletedDate: hadYesterdayCompletion ? yesterday : null,
      });
      expect(fixture.milestoneNotifier.userIds).toEqual([]);
      expect(fixture.statsReader.queries.map((query) => query.day)).toEqual([today, yesterday]);
    },
  );
  it("CAS 충돌 후 최신 완료 현황을 다시 읽고 처리 중 자정을 지나도 처음 선택한 날짜를 유지한다", async () => {
    // Given
    const fixture = givenContended();
    fixture.preferenceRepository.conflictOnNext({
      meanwhile: () => {
        fixture.statsReader.days.set(`${fixture.userId}/2026-01-16`, { total: 2, completed: 1 });
        fixture.clock.advanceBy({ hours: 24 });
      },
    });
    // When
    await fixture.useCase.execute({ userId: fixture.userId, completed: true });
    // Then
    expect(fixture.preferenceRepository.stored(fixture.userId)).toEqual(fixture.preference);
    expect(fixture.statsReader.queries.map((query) => query.day)).toEqual([today, today]);
    expect(fixture.milestoneNotifier.userIds).toEqual([]);
  });
  it("CAS 충돌 후 다른 요청이 반영한 최신 상태를 읽으면 덮어쓰거나 마일스톤을 재등록하지 않는다", async () => {
    // Given
    const fixture = givenContended();
    fixture.preferenceRepository.conflictOnNext({
      committed: { currentStreak: 7, longestStreak: 9, lastCompletedDate: today },
    });
    // When
    await fixture.useCase.execute({ userId: fixture.userId, completed: true });
    // Then
    expect(fixture.preferenceRepository.stored(fixture.userId)).toMatchObject({
      currentStreak: 7,
      longestStreak: 9,
      lastCompletedDate: today,
    });
    expect(fixture.milestoneNotifier.userIds).toEqual([]);
    expect(fixture.preferenceRepository.compareAndSetAttempts).toBe(1);
    expect(fixture.logger.messages).toEqual([]);
  });
  it("지속적인 충돌은 세 번까지만 재시도하고 Todo 처리 실패로 전파하지 않는다", async () => {
    // Given
    const fixture = givenContended();
    fixture.preferenceRepository.conflictOnNext({}, {}, {}, {});
    // When
    await expect(
      fixture.useCase.execute({ userId: fixture.userId, completed: true }),
    ).resolves.toBeUndefined();
    // Then
    expect(fixture.preferenceRepository.compareAndSetAttempts).toBe(3);
    expect(fixture.statsReader.queries).toHaveLength(3);
    expect(fixture.preferenceRepository.stored(fixture.userId)).toEqual(fixture.preference);
    expect(fixture.milestoneNotifier.userIds).toEqual([]);
    expect(fixture.logger.messages).toEqual([
      { event: PreferenceLogEvent.STREAK_UPDATE_CONFLICT, userId: fixture.userId, attempts: 3 },
    ]);
  });
  it("조회 실패는 격리하고 원래 오류 메시지·stack을 로그에 넣지 않는다", async () => {
    // Given
    const fixture = given();
    const useCase = new OnTodoToggledUseCase({ ...fixture, statsReader: new FailingStatsReader() });
    // When
    await expect(
      useCase.execute({ userId: fixture.userId, completed: true }),
    ).resolves.toBeUndefined();
    // Then
    expect(fixture.preferenceRepository.stored(fixture.userId)).toEqual(fixture.preference);
    expect(fixture.milestoneNotifier.userIds).toEqual([]);
    expect(fixture.logger.messages).toEqual([
      {
        event: PreferenceLogEvent.STREAK_UPDATE_FAILED,
        userId: fixture.userId,
        errorType: "Error",
      },
    ]);
    expect(JSON.stringify(fixture.logger.messages)).not.toContain("민감한 요청 원문");
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
    const fixture = createUserSettingsFixture();
    fixture.statsReader.days.set(`${fixture.userId}/${date}`, { total: 1, completed: 1 });
    const clock = new FixedClock(Temporal.Instant.from(at));
    // When
    await new OnTodoToggledUseCase({ ...fixture, clock }).execute({
      userId: fixture.userId,
      completed: true,
      timezone,
    });
    // Then
    const expectedDay = Temporal.PlainDate.from(date);
    expect(fixture.preferenceRepository.stored(fixture.userId)?.lastCompletedDate).toEqual(
      expectedDay,
    );
    expect(fixture.statsReader.queries).toEqual([
      {
        userId: fixture.userId,
        day: expectedDay,
      },
    ]);
  });
  it.each([
    {
      description: "봄 DST의 사라진 시간",
      first: "2026-03-08T06:30:00.000Z",
      date: "2026-03-08",
      prior: "2026-03-07",
    },
    {
      description: "가을 DST의 반복된 시간",
      first: "2026-11-01T05:30:00.000Z",
      date: "2026-11-01",
      prior: "2026-10-31",
    },
  ])(
    "$description: 같은 달력 날짜의 streak와 마일스톤은 한 번만 반영한다",
    async ({ first, date, prior }) => {
      // Given
      const fixture = createUserSettingsFixture({
        preference: {
          currentStreak: 2,
          longestStreak: 5,
          lastCompletedDate: Temporal.PlainDate.from(prior),
        },
      });
      fixture.statsReader.days.set(`${fixture.userId}/${date}`, { total: 1, completed: 1 });
      const clock = new FixedClock(Temporal.Instant.from(first));
      const useCase = new OnTodoToggledUseCase({ ...fixture, clock });
      const input = { userId: fixture.userId, completed: true, timezone: "America/New_York" };
      // When
      await useCase.execute(input);
      clock.advanceBy({ hours: 1 });
      await useCase.execute(input);
      // Then
      expect(fixture.preferenceRepository.stored(fixture.userId)).toMatchObject({
        currentStreak: 3,
        longestStreak: 5,
        lastCompletedDate: Temporal.PlainDate.from(date),
      });
      expect(fixture.milestoneNotifier.userIds).toEqual([fixture.userId]);
    },
  );
});
