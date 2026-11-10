import type { weeklyAchievement } from "#api/platform/database/schema/insights.schema";

import { WeeklyAchievement } from "../../domain/weekly-achievement.entity.js";

/** createdAt은 DB 기본값이 채우고 도메인은 쓰지 않으므로 고르지 않는다 */
type WeeklyAchievementRow = Omit<typeof weeklyAchievement.$inferSelect, "createdAt">;
type WeeklyAchievementInsertRow = typeof weeklyAchievement.$inferInsert;

export function toWeeklyAchievement(row: WeeklyAchievementRow): WeeklyAchievement {
  return WeeklyAchievement.reconstitute(row);
}

export function toWeeklyAchievementRow(achievement: WeeklyAchievement): WeeklyAchievementInsertRow {
  return achievement.toPrimitives();
}
