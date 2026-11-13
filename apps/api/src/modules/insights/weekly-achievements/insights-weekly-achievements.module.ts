import { Module } from "@nestjs/common";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";

import { WeeklyAchievementWriterPort } from "./application/ports/weekly-achievement-writer.port.js";
import { INSIGHTS_WEEKLY_ACHIEVEMENTS_PROVIDERS } from "./insights-weekly-achievements.providers.js";
import { WeeklyAchievementController } from "./presentation/http/v1/weekly-achievement.controller.js";

@Module({
  imports: [IdentitySettingsModule],
  controllers: [WeeklyAchievementController],
  providers: [...INSIGHTS_WEEKLY_ACHIEVEMENTS_PROVIDERS],
  exports: [WeeklyAchievementWriterPort],
})
export class InsightsWeeklyAchievementsModule {}
