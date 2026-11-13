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
