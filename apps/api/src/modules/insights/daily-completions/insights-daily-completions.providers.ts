import { type FactoryProvider } from "@nestjs/common";

import { DAILY_COMPLETION_CACHE } from "./application/ports/daily-completion-cache.port.js";
import { DAILY_COMPLETION_FOLLOW_READER } from "./application/ports/daily-completion-follow-reader.port.js";
import { TODO_COMPLETION_REPOSITORY } from "./application/ports/todo-completion.repository.port.js";
import { GetDailyCompletionsUseCase } from "./application/use-cases/get-daily-completions.use-case.js";
import { GetFriendDailyCompletionsUseCase } from "./application/use-cases/get-friend-daily-completions.use-case.js";

export const getDailyCompletionsProvider: FactoryProvider<GetDailyCompletionsUseCase> = {
  provide: GetDailyCompletionsUseCase,
  inject: [TODO_COMPLETION_REPOSITORY, DAILY_COMPLETION_CACHE],
  useFactory: (
    repository: ConstructorParameters<typeof GetDailyCompletionsUseCase>[0]["repository"],
    cache: ConstructorParameters<typeof GetDailyCompletionsUseCase>[0]["cache"],
  ) => new GetDailyCompletionsUseCase({ repository, cache }),
};

export const getFriendDailyCompletionsProvider: FactoryProvider<GetFriendDailyCompletionsUseCase> =
  {
    provide: GetFriendDailyCompletionsUseCase,
    inject: [TODO_COMPLETION_REPOSITORY, DAILY_COMPLETION_CACHE, DAILY_COMPLETION_FOLLOW_READER],
    useFactory: (
      repository: ConstructorParameters<typeof GetFriendDailyCompletionsUseCase>[0]["repository"],
      cache: ConstructorParameters<typeof GetFriendDailyCompletionsUseCase>[0]["cache"],
      followReader: ConstructorParameters<
        typeof GetFriendDailyCompletionsUseCase
      >[0]["followReader"],
    ) =>
      new GetFriendDailyCompletionsUseCase({
        repository,
        cache,
        followReader,
      }),
  };
