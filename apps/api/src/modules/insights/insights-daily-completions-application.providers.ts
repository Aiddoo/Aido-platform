import { type FactoryProvider } from "@nestjs/common";

import { DAILY_COMPLETION_CACHE } from "./application/ports/daily-completions/daily-completion-cache.port.js";
import { DAILY_COMPLETION_FOLLOW_READER } from "./application/ports/daily-completions/daily-completion-follow-reader.port.js";
import { TODO_COMPLETION_REPOSITORY } from "./application/ports/daily-completions/todo-completion.repository.port.js";
import { GetDailyCompletions } from "./application/use-cases/daily-completions/get-daily-completions.use-case.js";
import { GetFriendDailyCompletions } from "./application/use-cases/daily-completions/get-friend-daily-completions.use-case.js";

export const getDailyCompletionsProvider: FactoryProvider<GetDailyCompletions> = {
  provide: GetDailyCompletions,
  inject: [TODO_COMPLETION_REPOSITORY, DAILY_COMPLETION_CACHE],
  useFactory: (
    repository: ConstructorParameters<typeof GetDailyCompletions>[0]["repository"],
    cache: ConstructorParameters<typeof GetDailyCompletions>[0]["cache"],
  ) => new GetDailyCompletions({ repository, cache }),
};

export const getFriendDailyCompletionsProvider: FactoryProvider<GetFriendDailyCompletions> = {
  provide: GetFriendDailyCompletions,
  inject: [TODO_COMPLETION_REPOSITORY, DAILY_COMPLETION_CACHE, DAILY_COMPLETION_FOLLOW_READER],
  useFactory: (
    repository: ConstructorParameters<typeof GetFriendDailyCompletions>[0]["repository"],
    cache: ConstructorParameters<typeof GetFriendDailyCompletions>[0]["cache"],
    followReader: ConstructorParameters<typeof GetFriendDailyCompletions>[0]["followReader"],
  ) =>
    new GetFriendDailyCompletions({
      repository,
      cache,
      followReader,
    }),
};
