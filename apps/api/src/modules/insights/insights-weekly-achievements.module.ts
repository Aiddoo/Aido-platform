import { Module } from "@nestjs/common";

import { WeeklyAchievementWriterAccess } from "./application/access/weekly-achievements/weekly-achievement-writer.access.js";
import { WEEKLY_ACHIEVEMENT_REPOSITORY } from "./application/ports/weekly-achievements/weekly-achievement.repository.port.js";
import { UpsertWeeklyAchievements } from "./application/use-cases/weekly-achievements/upsert-weekly-achievements.use-case.js";
import { PrismaWeeklyAchievementRepository } from "./infrastructure/persistence/weekly-achievements/prisma-weekly-achievement.repository.js";
import { WEEKLY_ACHIEVEMENT_PROVIDERS } from "./insights-weekly-achievements.providers.js";
import { WeeklyAchievementController } from "./presentation/controllers/weekly-achievements/weekly-achievement.controller.js";

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
      inject: [UpsertWeeklyAchievements],
      useFactory: (upsertWeeklyAchievementsUseCase: UpsertWeeklyAchievements) =>
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
