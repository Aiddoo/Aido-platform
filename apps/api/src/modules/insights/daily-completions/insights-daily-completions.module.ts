import { Module } from "@nestjs/common";

import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";
import { SocialFriendshipsModule } from "#api/modules/social/friendships/social-friendships.public";
import { provideEventSubscriptions } from "#api/platform/events/event-subscription.catalog";

import { DAILY_COMPLETION_CACHE_SUBSCRIPTIONS } from "./infrastructure/event-handlers/daily-completion-cache.event-handler.js";
import { INSIGHTS_DAILY_COMPLETIONS_PROVIDERS } from "./insights-daily-completions.providers.js";
import { DailyCompletionController } from "./presentation/http/v1/daily-completion.controller.js";

@Module({
  imports: [SocialFriendshipsModule, PlanningTodoQueriesModule],
  controllers: [DailyCompletionController],
  providers: [
    ...INSIGHTS_DAILY_COMPLETIONS_PROVIDERS,
    provideEventSubscriptions(...DAILY_COMPLETION_CACHE_SUBSCRIPTIONS),
  ],
})
export class InsightsDailyCompletionsModule {}
