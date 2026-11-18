import type { Provider } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";

import { CompletionGroupReaderPort } from "./application/ports/completion-group.reader.port.js";
import { DailyCompletionCachePort } from "./application/ports/daily-completion-cache.port.js";
import { FriendshipReaderPort } from "./application/ports/friendship.reader.port.js";
import { GetDailyCompletionsUseCase } from "./application/use-cases/get-daily-completions.use-case.js";
import { GetFriendDailyCompletionsUseCase } from "./application/use-cases/get-friend-daily-completions.use-case.js";
import { FriendshipReaderAdapter } from "./infrastructure/adapters/friendship-reader.adapter.js";
import { PlanningCompletionGroupReaderAdapter } from "./infrastructure/adapters/planning-completion-group-reader.adapter.js";
import { DailyCompletionCache } from "./infrastructure/cache/daily-completion.cache.js";
import { DailyCompletionCacheEventHandler } from "./infrastructure/event-handlers/daily-completion-cache.event-handler.js";

export const INSIGHTS_DAILY_COMPLETIONS_PROVIDERS = [
  { provide: CompletionGroupReaderPort, useClass: PlanningCompletionGroupReaderAdapter },
  { provide: DailyCompletionCachePort, useClass: DailyCompletionCache },
  { provide: FriendshipReaderPort, useClass: FriendshipReaderAdapter },
  provideUseCase(DailyCompletionCacheEventHandler, {
    dailyCompletionCache: DailyCompletionCachePort,
    eventEmitter: EventEmitter2,
    logger: loggerFor(DailyCompletionCacheEventHandler),
  }),
  provideUseCase(GetDailyCompletionsUseCase, {
    completionGroupReader: CompletionGroupReaderPort,
    dailyCompletionCache: DailyCompletionCachePort,
  }),
  provideUseCase(GetFriendDailyCompletionsUseCase, {
    completionGroupReader: CompletionGroupReaderPort,
    dailyCompletionCache: DailyCompletionCachePort,
    friendshipReader: FriendshipReaderPort,
  }),
] satisfies Provider[];
