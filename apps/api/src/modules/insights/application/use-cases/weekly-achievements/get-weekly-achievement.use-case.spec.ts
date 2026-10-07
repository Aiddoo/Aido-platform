import { ErrorCode } from "@aido/api/errors";

import type { SupportedLocale } from "#api/shared/domain/locale";
import {
  createInsightsFixture,
  createWeeklyAchievementFixture,
  INSIGHTS_TIME,
} from "#test/fixtures/insights.fixture";

import { GetWeeklyAchievement } from "./get-weekly-achievement.use-case.js";

describe("GetWeeklyAchievement", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INSIGHTS_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    { locale: "ko", label: "3월 1주차" },
    { locale: "en", label: "Week 1 of Mar" },
  ] satisfies ReadonlyArray<{ locale: SupportedLocale; label: string }>)(
    "$locale 조회에서 같은 기록의 완료율·주간 날짜를 유지하고 라벨을 번역한다",
    async ({ locale, label }) => {
      // Given
      const fixture = createInsightsFixture();
      fixture.weeklyRepository.rows.set(
        JSON.stringify([fixture.userId, 2026, 10]),
        createWeeklyAchievementFixture(),
      );
      const useCase = new GetWeeklyAchievement({ repository: fixture.weeklyRepository });
      // When
      const result = await useCase.execute({
        userId: fixture.userId,
        year: 2026,
        week: 10,
        locale,
      });
      // Then
      expect(result).toEqual({
        id: 1,
        year: 2026,
        week: 10,
        weekLabel: label,
        dateRange: { startDate: "2026-03-02", endDate: "2026-03-08" },
        totalTodos: 10,
        completedTodos: 7,
        completionRate: 70,
        achievedAt: "2026-03-09T00:00:00.000Z",
      });
    },
  );

  it("다른 사용자의 기록으로 요청자의 누락된 주차를 채우지 않는다", async () => {
    // Given
    const fixture = createInsightsFixture();
    fixture.weeklyRepository.rows.set(
      JSON.stringify([fixture.viewerId, 2026, 10]),
      createWeeklyAchievementFixture(),
    );
    const useCase = new GetWeeklyAchievement({ repository: fixture.weeklyRepository });
    // When, Then
    await expect(
      useCase.execute({ userId: fixture.userId, year: 2026, week: 10, locale: "ko" }),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.ACHIEVEMENT_1801,
      details: { year: 2026, week: 10 },
    });
  });
});
