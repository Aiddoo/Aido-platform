import type { WeeklyAchievementUpsert } from "../../../domain/records/weekly-achievements/weekly-achievement.record.js";

export const WEEKLY_ACHIEVEMENT_WRITER = Symbol("WEEKLY_ACHIEVEMENT_WRITER");

export interface WeeklyAchievementWriterPort {
  execute(input: { readonly records: readonly WeeklyAchievementUpsert[] }): Promise<void>;
}
