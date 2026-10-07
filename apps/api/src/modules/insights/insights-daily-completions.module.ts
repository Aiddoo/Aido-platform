import { Module } from "@nestjs/common";

import { FOLLOW_READER, SocialFriendsModule } from "#api/modules/social/social-friends.public";

import { DAILY_COMPLETION_CACHE } from "./application/ports/daily-completions/daily-completion-cache.port.js";
import { DAILY_COMPLETION_FOLLOW_READER } from "./application/ports/daily-completions/daily-completion-follow-reader.port.js";
import { TODO_COMPLETION_REPOSITORY } from "./application/ports/daily-completions/todo-completion.repository.port.js";
import { DailyCompletionCacheAdapter } from "./infrastructure/adapters/daily-completions/daily-completion-cache.adapter.js";
import { PrismaTodoCompletionRepository } from "./infrastructure/persistence/daily-completions/prisma-todo-completion.repository.js";
import { DailyCompletionCacheInvalidator } from "./infrastructure/subscribers/daily-completions/daily-completion-cache.invalidator.js";
import {
  getDailyCompletionsProvider,
  getFriendDailyCompletionsProvider,
} from "./insights-daily-completions-application.providers.js";
import { DailyCompletionController } from "./presentation/controllers/daily-completions/daily-completion.controller.js";

@Module({
  imports: [SocialFriendsModule],
  controllers: [DailyCompletionController],
  providers: [
    {
      provide: TODO_COMPLETION_REPOSITORY,
      useClass: PrismaTodoCompletionRepository,
    },
    {
      provide: DAILY_COMPLETION_CACHE,
      useClass: DailyCompletionCacheAdapter,
    },
    { provide: DAILY_COMPLETION_FOLLOW_READER, useExisting: FOLLOW_READER },
    DailyCompletionCacheInvalidator,
    getDailyCompletionsProvider,
    getFriendDailyCompletionsProvider,
  ],
})
export class InsightsDailyCompletionsModule {}
