import { GetWeeklyAchievementUseCase } from "./queries/get-weekly-achievement/get-weekly-achievement.use-case";
import { GetWeeklyAchievementsUseCase } from "./queries/get-weekly-achievements/get-weekly-achievements.use-case";
import { UpsertWeeklyAchievementsUseCase } from "./use-cases/upsert-weekly-achievements/upsert-weekly-achievements.use-case";

export const WEEKLY_ACHIEVEMENT_PROVIDERS = [
	GetWeeklyAchievementsUseCase,
	GetWeeklyAchievementUseCase,
	UpsertWeeklyAchievementsUseCase,
] as const;
