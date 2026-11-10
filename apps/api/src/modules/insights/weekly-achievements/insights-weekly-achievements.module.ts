import { Module } from "@nestjs/common";

import { WEEKLY_ACHIEVEMENT_WRITER } from "./application/ports/weekly-achievement-writer.port.js";
import { WEEKLY_ACHIEVEMENT_REPOSITORY } from "./application/ports/weekly-achievement.repository.port.js";
import { RecordWeeklyAchievementsUseCase } from "./application/use-cases/record-weekly-achievements.use-case.js";
import { DrizzleWeeklyAchievementRepository } from "./infrastructure/persistence/drizzle-weekly-achievement.repository.js";
import {
  getWeeklyAchievementProvider,
  getWeeklyAchievementsProvider,
  upsertWeeklyAchievementsProvider,
} from "./insights-weekly-achievements.providers.js";
import { WeeklyAchievementController } from "./presentation/http/v1/weekly-achievement.controller.js";

@Module({
  controllers: [WeeklyAchievementController],
  providers: [
    { provide: WEEKLY_ACHIEVEMENT_WRITER, useExisting: RecordWeeklyAchievementsUseCase },
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
