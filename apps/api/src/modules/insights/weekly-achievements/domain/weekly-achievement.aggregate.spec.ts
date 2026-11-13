import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createWeeklyAchievementFixture,
  WEEKLY_ACHIEVEMENT_FIXTURE_NOW,
  WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
} from "#test/fixtures/insights/weekly-achievement.fixture";

import { WeeklyAchievementId } from "./weekly-achievement-id.vo.js";
import { WeeklyAchievement } from "./weekly-achievement.aggregate.js";

function create(overrides: { totalTodos?: number; completedTodos?: number; week?: number } = {}) {
  return WeeklyAchievement.create({
    id: WeeklyAchievementId.reconstitute(1),
    userId: UserId.reconstitute(WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID),
    year: 2026,
    week: overrides.week ?? 10,
    totalTodos: overrides.totalTodos ?? 5,
    completedTodos: overrides.completedTodos ?? 3,
    achievedAt: WEEKLY_ACHIEVEMENT_FIXTURE_NOW,
  });
}

describe("WeeklyAchievement", () => {
  it.each([
    { input: { totalTodos: -1 }, details: { field: "totalTodos", value: -1 } },
    {
      input: { totalTodos: 2, completedTodos: 5 },
      details: { field: "completedTodos", completedTodos: 5, totalTodos: 2 },
    },
    { input: { week: 54 }, details: { field: "week", value: 54 } },
  ])("집계 불변식을 어기면 SYS_0002와 어긴 칸을 알린다 ($details.field)", ({ input, details }) => {
    // When
    const creating = () => create(input);

    // Then
    expect(creating).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002, details }));
  });

  it.each([
    { totalTodos: 10, completedTodos: 10, completionRate: 100, isPerfect: true },
    { totalTodos: 3, completedTodos: 2, completionRate: 67, isPerfect: false },
    { totalTodos: 0, completedTodos: 0, completionRate: 0, isPerfect: false },
  ])(
    "$completedTodos/$totalTodos 주는 완료율 $completionRate, 완벽한 주 $isPerfect",
    ({ totalTodos, completedTodos, completionRate, isPerfect }) => {
      // Given
      const achievement = createWeeklyAchievementFixture({ totalTodos, completedTodos });

      // When
      const result = {
        completionRate: achievement.completionRate,
        isPerfect: achievement.isPerfect(),
      };

      // Then
      expect(result).toEqual({ completionRate, isPerfect });
    },
  );
});
