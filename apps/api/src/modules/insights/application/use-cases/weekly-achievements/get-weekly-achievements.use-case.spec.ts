import {
  createInsightsFixture,
  createWeeklyAchievementFixture,
  INSIGHTS_TIME,
} from "#test/fixtures/insights.fixture";

import { GetWeeklyAchievements } from "./get-weekly-achievements.use-case.js";

describe("GetWeeklyAchievements", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INSIGHTS_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("페이지 밖의 주차도 연도 요약에 포함하고 다음 커서를 마지막 노출 주차로 반환한다", async () => {
    // Given
    const fixture = createInsightsFixture();
    const records = [1, 2, 3].map((week) =>
      createWeeklyAchievementFixture({ id: week, week, totalTodos: 5, completedTodos: 5 }),
    );
    const key = JSON.stringify([fixture.userId, 2026]);
    fixture.weeklyRepository.pages.set(key, [...records].reverse());
    fixture.weeklyRepository.years.set(key, records);
    const query = vi.spyOn(fixture.weeklyRepository, "findByYear");
    const useCase = new GetWeeklyAchievements({
      repository: fixture.weeklyRepository,
      paginationService: fixture.paginationService,
    });
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      year: 2026,
      size: 2,
      locale: "ko",
    });
    // Then
    expect(query).toHaveBeenCalledWith(fixture.userId, 2026, undefined, 3);
    expect(result.items.map((item) => item.week)).toEqual([3, 2]);
    expect(result.pagination).toEqual({ nextCursor: 2, hasNext: true, size: 2 });
    expect(result.summary).toEqual({
      totalWeeks: 3,
      perfectWeeks: 3,
      currentStreak: 3,
      bestStreak: 3,
      averageRate: 100,
    });
  });

  it("정확히 페이지 크기만큼 남으면 마지막 페이지로 반환한다", async () => {
    // Given
    const fixture = createInsightsFixture();
    const records = [2, 1].map((week) => createWeeklyAchievementFixture({ id: week, week }));
    const key = JSON.stringify([fixture.userId, 2026]);
    fixture.weeklyRepository.pages.set(key, records);
    fixture.weeklyRepository.years.set(key, records);
    const useCase = new GetWeeklyAchievements({
      repository: fixture.weeklyRepository,
      paginationService: fixture.paginationService,
    });
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      year: 2026,
      size: 2,
      locale: "ko",
    });
    // Then
    expect(result.items.map((item) => item.week)).toEqual([2, 1]);
    expect(result.pagination).toEqual({ nextCursor: null, hasNext: false, size: 2 });
  });

  it("기록 없는 연도는 기본 페이지 크기와 빈 요약을 반환한다", async () => {
    // Given
    const fixture = createInsightsFixture();
    const useCase = new GetWeeklyAchievements({
      repository: fixture.weeklyRepository,
      paginationService: fixture.paginationService,
    });
    // When
    const result = await useCase.execute({ userId: fixture.userId, year: 2026, locale: "ko" });
    // Then
    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual({ nextCursor: null, hasNext: false, size: 20 });
    expect(result.summary).toEqual({
      totalWeeks: 0,
      perfectWeeks: 0,
      currentStreak: 0,
      bestStreak: 0,
      averageRate: 0,
    });
  });
});
