import { Module } from "@nestjs/common";

import { WeeklyAchievementWriterAccess } from "./application/access/weekly-achievement-writer.access";
import { WEEKLY_ACHIEVEMENT_REPOSITORY } from "./application/ports/weekly-achievement.repository.port";
import { UpsertWeeklyAchievementsUseCase } from "./application/use-cases/upsert-weekly-achievements/upsert-weekly-achievements.use-case";
import { WEEKLY_ACHIEVEMENT_PROVIDERS } from "./application/weekly-achievement.providers";
import { PrismaWeeklyAchievementRepository } from "./infrastructure/adapters/prisma-weekly-achievement.repository";
import { WeeklyAchievementController } from "./presentation/weekly-achievement.controller";

/**
 * WeeklyAchievement 모듈 (클린아키텍처)
 *
 * 주간 할 일 달성 현황을 조회(연도별 목록·주차 상세)하고, 스케줄러 배치가 일괄
 * upsert를 호출한다. 통계 계산(streak·요약·주차 라벨)은 도메인이 소유하며,
 * 저장은 포트로 추상화된다.
 *
 * Facade를 export하여 스케줄러(미이관 모듈)가 배럴로 주입한다.
 */
@Module({
	controllers: [WeeklyAchievementController],
	providers: [
		{
			provide: WeeklyAchievementWriterAccess,
			inject: [UpsertWeeklyAchievementsUseCase],
			useFactory: (upsertWeeklyAchievementsUseCase: UpsertWeeklyAchievementsUseCase) =>
				new WeeklyAchievementWriterAccess(upsertWeeklyAchievementsUseCase),
		},
		{
			provide: WEEKLY_ACHIEVEMENT_REPOSITORY,
			useClass: PrismaWeeklyAchievementRepository,
		},
		...WEEKLY_ACHIEVEMENT_PROVIDERS,
	],
	exports: [WeeklyAchievementWriterAccess],
})
export class WeeklyAchievementModule {}
