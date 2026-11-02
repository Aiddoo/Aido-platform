import { Module } from "@nestjs/common";

import { WEEKLY_ACHIEVEMENT_WRITER } from "./application/ports/weekly-achievements/weekly-achievement-writer.port.js";
import { WEEKLY_ACHIEVEMENT_REPOSITORY } from "./application/ports/weekly-achievements/weekly-achievement.repository.port.js";
import { UpsertWeeklyAchievements } from "./application/use-cases/weekly-achievements/upsert-weekly-achievements.use-case.js";
import { DrizzleWeeklyAchievementRepository } from "./infrastructure/persistence/weekly-achievements/drizzle-weekly-achievement.repository.js";
import {
  getWeeklyAchievementProvider,
  getWeeklyAchievementsProvider,
  upsertWeeklyAchievementsProvider,
} from "./insights-weekly-achievements-application.providers.js";
import { WeeklyAchievementController } from "./presentation/controllers/weekly-achievements/v1/weekly-achievement.controller.js";

@Module({
  controllers: [WeeklyAchievementController],
  providers: [
    { provide: WEEKLY_ACHIEVEMENT_WRITER, useExisting: UpsertWeeklyAchievements },
    {
      provide: WEEKLY_ACHIEVEMENT_REPOSITORY,
      useClass: DrizzleWeeklyAchievementRepository,
    },
    getWeeklyAchievementProvider,
    getWeeklyAchievementsProvider,
    upsertWeeklyAchievementsProvider,
  ],
  exports: [WEEKLY_ACHIEVEMENT_WRITER],
})
export class InsightsWeeklyAchievementsModule {}
