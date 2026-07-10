import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { WeeklyAchievementFacade } from "./application/facades/weekly-achievement.facade";
import { WEEKLY_ACHIEVEMENT_REPOSITORY } from "./application/ports/weekly-achievement.repository.port";
import { QueryHandlers } from "./application/queries/handlers";
import { CommandHandlers } from "./application/use-cases";
import { PrismaWeeklyAchievementRepository } from "./infrastructure/adapters/prisma-weekly-achievement.repository";
import { WeeklyAchievementController } from "./presentation/weekly-achievement.controller";

/**
 * WeeklyAchievement 모듈 (클린아키텍처 + CQRS)
 *
 * 주간 할 일 달성 현황을 조회(연도별 목록·주차 상세)하고, 스케줄러 배치가 일괄
 * upsert를 디스패치한다. 통계 계산(streak·요약·주차 라벨)은 도메인이 소유하며,
 * 저장은 포트로 추상화된다.
 *
 * Facade를 export하여 스케줄러(미이관 모듈)가 배럴로 주입한다.
 */
@Module({
	imports: [CqrsModule],
	controllers: [WeeklyAchievementController],
	providers: [
		WeeklyAchievementFacade,
		{
			provide: WEEKLY_ACHIEVEMENT_REPOSITORY,
			useClass: PrismaWeeklyAchievementRepository,
		},
		...QueryHandlers,
		...CommandHandlers,
	],
	exports: [WeeklyAchievementFacade],
})
export class WeeklyAchievementModule {}
