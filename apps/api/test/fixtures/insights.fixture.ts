import type { TodoAggregateByDate } from "#api/modules/insights/domain/records/daily-completions/daily-completion.record";
import type {
  WeeklyAchievementRow,
  WeeklyAchievementUpsert,
} from "#api/modules/insights/domain/records/weekly-achievements/weekly-achievement.record";
import { PaginationService } from "#api/shared/application/pagination/index";
import {
  StubDailyCompletionCache,
  StubInsightsFriend,
  StubTodoCompletionRepository,
  StubWeeklyAchievementRepository,
} from "#test/mocks/ports/insights.stub";

export const INSIGHTS_TIME = new Date("2028-02-29T12:00:00.000Z");
export const INSIGHTS_USER_ID = "insights-owner";
export const INSIGHTS_VIEWER_ID = "insights-viewer";

export function createTodoAggregateFixture(
  overrides: Partial<TodoAggregateByDate> = {},
): TodoAggregateByDate {
  return structuredClone({
    date: new Date("2028-02-29T00:00:00.000Z"),
    total: 3,
    completed: 3,
    categoryColors: ["#123456"],
    ...overrides,
  });
}
export function createWeeklyAchievementFixture(
  overrides: Partial<WeeklyAchievementRow> = {},
): WeeklyAchievementRow {
  return structuredClone({
    id: 1,
    year: 2026,
    week: 10,
    totalTodos: 10,
    completedTodos: 7,
    achievedAt: new Date("2026-03-09T00:00:00.000Z"),
    ...overrides,
  });
}
export function createWeeklyAchievementWriteFixture(
  overrides: Partial<WeeklyAchievementUpsert> = {},
): WeeklyAchievementUpsert {
  return structuredClone({
    userId: INSIGHTS_USER_ID,
    year: 2026,
    week: 10,
    totalTodos: 5,
    completedTodos: 3,
    achievedAt: new Date("2026-03-09T00:00:00.000Z"),
    ...overrides,
  });
}
export function createInsightsFixture() {
  const repository = new StubTodoCompletionRepository();
  const cache = new StubDailyCompletionCache();
  const followReader = new StubInsightsFriend();
  followReader.mutualPairs.add(JSON.stringify([INSIGHTS_VIEWER_ID, INSIGHTS_USER_ID]));
  const weeklyRepository = new StubWeeklyAchievementRepository();
  const paginationService = new PaginationService();
  return {
    userId: INSIGHTS_USER_ID,
    viewerId: INSIGHTS_VIEWER_ID,
    repository,
    cache,
    followReader,
    weeklyRepository,
    paginationService,
  };
}
