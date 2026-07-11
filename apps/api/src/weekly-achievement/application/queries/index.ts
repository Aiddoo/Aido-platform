import { GetWeeklyAchievementUseCase } from "./get-weekly-achievement/get-weekly-achievement.use-case";
import { GetWeeklyAchievementsUseCase } from "./get-weekly-achievements/get-weekly-achievements.use-case";

/** 모듈 등록용 쿼리 use-case 목록 */
export const WeeklyAchievementQueryUseCases = [
	GetWeeklyAchievementsUseCase,
	GetWeeklyAchievementUseCase,
];
