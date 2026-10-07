import {
  getWeeklyAchievementsProvider,
  getWeeklyAchievementProvider,
  upsertWeeklyAchievementsProvider,
} from "./insights-weekly-achievements-application.providers.js";

export const WEEKLY_ACHIEVEMENT_PROVIDERS = [
  getWeeklyAchievementsProvider,
  getWeeklyAchievementProvider,
  upsertWeeklyAchievementsProvider,
] as const;
