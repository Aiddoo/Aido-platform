import { Module } from "@nestjs/common";

import { InsightsDailyCompletionsModule } from "./daily-completions/insights-daily-completions.module.js";
import { InsightsWeeklyAchievementsModule } from "./weekly-achievements/insights-weekly-achievements.module.js";

@Module({
  imports: [InsightsDailyCompletionsModule, InsightsWeeklyAchievementsModule],
  exports: [InsightsWeeklyAchievementsModule],
})
export class InsightsModule {}
