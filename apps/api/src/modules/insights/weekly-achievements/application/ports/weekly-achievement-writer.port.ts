import type { WeeklyAchievementUpsert } from "../../domain/weekly-achievement.read-model.js";

export const WEEKLY_ACHIEVEMENT_WRITER = Symbol("WEEKLY_ACHIEVEMENT_WRITER");

export interface WeeklyAchievementWriterPort {
  execute(input: { readonly records: readonly WeeklyAchievementUpsert[] }): Promise<void>;
}
