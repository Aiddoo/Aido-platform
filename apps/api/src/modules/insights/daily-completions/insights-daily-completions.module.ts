import { Module } from "@nestjs/common";

import { SocialFriendsModule } from "#api/modules/social/social-friends.public";

import { INSIGHTS_DAILY_COMPLETIONS_PROVIDERS } from "./insights-daily-completions.providers.js";
import { DailyCompletionController } from "./presentation/http/v1/daily-completion.controller.js";

@Module({
  imports: [SocialFriendsModule],
  controllers: [DailyCompletionController],
  providers: [...INSIGHTS_DAILY_COMPLETIONS_PROVIDERS],
})
export class InsightsDailyCompletionsModule {}
