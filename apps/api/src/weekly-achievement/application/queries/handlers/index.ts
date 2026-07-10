import { GetWeeklyAchievementHandler } from "./get-weekly-achievement.handler";
import { GetWeeklyAchievementsHandler } from "./get-weekly-achievements.handler";

/** 모듈 등록용 쿼리 핸들러 목록 */
export const QueryHandlers = [
	GetWeeklyAchievementsHandler,
	GetWeeklyAchievementHandler,
];
