import type { WeeklyAchievementTally } from "#api/modules/insights/weekly-achievements/application/ports/weekly-achievement-writer.port";
import {
  WeeklyAchievement,
  type WeeklyAchievementPrimitives,
} from "#api/modules/insights/weekly-achievements/domain/weekly-achievement.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export const WEEKLY_ACHIEVEMENT_FIXTURE_NOW = Temporal.Instant.from("2026-03-09T00:00:00Z");
export const WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";
export const WEEKLY_ACHIEVEMENT_FIXTURE_OTHER_USER_ID = "clz7x5p8k0002qz0z8z8z8z8z";

export function createWeeklyAchievementFixture(
  overrides: Partial<WeeklyAchievementPrimitives> = {},
): WeeklyAchievement {
  return WeeklyAchievement.reconstitute({
    id: 1,
    userId: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
    year: 2026,
    week: 10,
    totalTodos: 10,
    completedTodos: 7,
    achievedAt: WEEKLY_ACHIEVEMENT_FIXTURE_NOW,
    ...overrides,
  });
}

/** notification 주간 리마인더가 넘기는 한 사용자·주의 할 일 수 */
export function createWeeklyAchievementTallyFixture(
  overrides: Partial<WeeklyAchievementTally> = {},
): WeeklyAchievementTally {
  return {
    userId: UserId.reconstitute(WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID),
    year: 2026,
    week: 10,
    totalTodos: 5,
    completedTodos: 3,
    achievedAt: WEEKLY_ACHIEVEMENT_FIXTURE_NOW,
    ...overrides,
  };
}
