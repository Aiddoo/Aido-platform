import { InMemoryWeeklyAchievementRepository } from "#test/doubles/insights/in-memory-weekly-achievement.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import {
  createWeeklyAchievementFixture,
  WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
} from "#test/fixtures/insights/weekly-achievement.fixture";

import { ListWeeklyAchievementsUseCase } from "./list-weekly-achievements.use-case.js";

function useCaseWith(weeks: readonly number[]) {
  return new ListWeeklyAchievementsUseCase({
    weeklyAchievementRepository: new InMemoryWeeklyAchievementRepository(
      weeks.map((week) =>
        createWeeklyAchievementFixture({ id: week, week, totalTodos: 5, completedTodos: 5 }),
      ),
    ),
    ownerTimezoneReader: { read: async () => "Asia/Seoul" },
    clock: new FixedClock(Temporal.Instant.from("2026-11-12T00:00:00Z")),
  });
}

describe("ListWeeklyAchievementsUseCase", () => {
  it("페이지 밖의 주도 연도 요약에 넣고 다음 커서를 마지막으로 보인 주로 준다", async () => {
    // Given
    const useCase = useCaseWith([1, 2, 3]);

    // When
    const result = await useCase.execute({
      userId: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
      year: 2026,
      size: 2,
    });

    // Then
    expect(result.page.items.map((item) => item.isoWeek.week)).toEqual([3, 2]);
    expect(result.page.pagination).toEqual({ nextCursor: 2, hasNext: true, size: 2 });
    expect(result.summary).toEqual({
      totalWeeks: 3,
      perfectWeeks: 3,
      currentStreak: 3,
      bestStreak: 3,
      averageRate: 100,
    });
  });

  it("커서 주 다음부터 이어 주고 정확히 페이지 크기만큼 남으면 마지막 페이지다", async () => {
    // Given
    const useCase = useCaseWith([1, 2, 3]);

    // When
    const result = await useCase.execute({
      userId: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
      year: 2026,
      cursor: 3,
      size: 2,
    });

    // Then
    expect(result.page.items.map((item) => item.isoWeek.week)).toEqual([2, 1]);
    expect(result.page.pagination).toEqual({ nextCursor: null, hasNext: false, size: 2 });
  });

  describe("ISO 연도가 바뀌는 주", () => {
    // 2027-01-04 월요일 주간 리마인더가 2026년 53주를 남기고, 한 주 뒤 2027년 1주를 남긴다
    function useCaseAcrossYearBoundary() {
      return new ListWeeklyAchievementsUseCase({
        weeklyAchievementRepository: new InMemoryWeeklyAchievementRepository([
          createWeeklyAchievementFixture({ id: 1, year: 2026, week: 51, completedTodos: 10 }),
          createWeeklyAchievementFixture({ id: 2, year: 2026, week: 52, completedTodos: 10 }),
          createWeeklyAchievementFixture({ id: 3, year: 2026, week: 53, completedTodos: 9 }),
          createWeeklyAchievementFixture({ id: 4, year: 2027, week: 1, completedTodos: 8 }),
        ]),
        ownerTimezoneReader: { read: async () => "Asia/Seoul" },
        clock: new FixedClock(Temporal.Instant.from("2027-01-11T00:00:00Z")),
      });
    }

    it("새해 1주의 연속 주는 지난해 52·53주에서 끊기지 않고 이어 센다", async () => {
      // Given
      const useCase = useCaseAcrossYearBoundary();

      // When
      const result = await useCase.execute({
        userId: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
        year: 2027,
      });

      // Then
      expect(result.page.items.map(({ isoWeek }) => [isoWeek.year, isoWeek.week])).toEqual([
        [2027, 1],
      ]);
      expect(result.summary).toEqual({
        totalWeeks: 1,
        perfectWeeks: 0,
        currentStreak: 4,
        bestStreak: 4,
        averageRate: 80,
      });
    });

    it("지난해 목록은 53주까지 주고 요약은 새해 기록이 쌓여도 그해 끝에서 멈춘다", async () => {
      // Given
      const useCase = useCaseAcrossYearBoundary();

      // When
      const result = await useCase.execute({
        userId: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
        year: 2026,
      });

      // Then
      expect(result.page.items.map(({ isoWeek }) => isoWeek.week)).toEqual([53, 52, 51]);
      expect(result.summary).toEqual({
        totalWeeks: 3,
        perfectWeeks: 2,
        currentStreak: 3,
        bestStreak: 3,
        averageRate: 97,
      });
    });
  });

  it("기록 없는 연도는 기본 페이지 크기와 빈 요약을 준다", async () => {
    // Given
    const useCase = useCaseWith([]);

    // When
    const result = await useCase.execute({
      userId: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
      year: 2026,
    });

    // Then
    expect(result.page.items).toEqual([]);
    expect(result.page.pagination).toEqual({ nextCursor: null, hasNext: false, size: 20 });
    expect(result.summary).toEqual({
      totalWeeks: 0,
      perfectWeeks: 0,
      currentStreak: 0,
      bestStreak: 0,
      averageRate: 0,
    });
  });
});
