import { Module } from "@nestjs/common";

import { WEEKLY_ACHIEVEMENT_WRITER } from "./application/ports/weekly-achievements/weekly-achievement-writer.port.js";
import { WEEKLY_ACHIEVEMENT_REPOSITORY } from "./application/ports/weekly-achievements/weekly-achievement.repository.port.js";
import { UpsertWeeklyAchievements } from "./application/use-cases/weekly-achievements/upsert-weekly-achievements.use-case.js";
import { PrismaWeeklyAchievementRepository } from "./infrastructure/persistence/weekly-achievements/prisma-weekly-achievement.repository.js";
import {
  getWeeklyAchievementProvider,
  getWeeklyAchievementsProvider,
  upsertWeeklyAchievementsProvider,
} from "./insights-weekly-achievements-application.providers.js";
import { WeeklyAchievementController } from "./presentation/controllers/weekly-achievements/weekly-achievement.controller.js";

@Module({
  controllers: [WeeklyAchievementController],
  providers: [
    { provide: WEEKLY_ACHIEVEMENT_WRITER, useExisting: UpsertWeeklyAchievements },
    {
      provide: WEEKLY_ACHIEVEMENT_REPOSITORY,
      useClass: PrismaWeeklyAchievementRepository,
    },
    getWeeklyAchievementProvider,
    getWeeklyAchievementsProvider,
    upsertWeeklyAchievementsProvider,
  ],
  exports: [WEEKLY_ACHIEVEMENT_WRITER],
})
export class InsightsWeeklyAchievementsModule {}
