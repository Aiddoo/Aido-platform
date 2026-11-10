import { Module } from "@nestjs/common";

import { FOLLOW_READER, SocialFriendsModule } from "#api/modules/social/social-friends.public";

import { DAILY_COMPLETION_CACHE } from "./application/ports/daily-completion-cache.port.js";
import { DAILY_COMPLETION_FOLLOW_READER } from "./application/ports/daily-completion-follow-reader.port.js";
import { TODO_COMPLETION_REPOSITORY } from "./application/ports/todo-completion.repository.port.js";
import { DailyCompletionCache } from "./infrastructure/cache/daily-completion.cache.js";
import { DailyCompletionCacheEventHandler } from "./infrastructure/event-handlers/daily-completion-cache.event-handler.js";
import { DrizzleTodoCompletionRepository } from "./infrastructure/persistence/drizzle-todo-completion.repository.js";
import {
  getDailyCompletionsProvider,
  getFriendDailyCompletionsProvider,
} from "./insights-daily-completions.providers.js";
import { DailyCompletionController } from "./presentation/http/v1/daily-completion.controller.js";

@Module({
  imports: [SocialFriendsModule],
  controllers: [DailyCompletionController],
  providers: [
    {
      provide: TODO_COMPLETION_REPOSITORY,
      useClass: DrizzleTodoCompletionRepository,
    },
    {
      provide: DAILY_COMPLETION_CACHE,
      useClass: DailyCompletionCache,
    },
    { provide: DAILY_COMPLETION_FOLLOW_READER, useExisting: FOLLOW_READER },
    DailyCompletionCacheEventHandler,
    getDailyCompletionsProvider,
    getFriendDailyCompletionsProvider,
  ],
})
export class InsightsDailyCompletionsModule {}
