import type { UserTimezoneReaderPort } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import type { SingleTodoCountReaderPort } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  resolveSuggestionTimeZone,
  suggestionAnalysisPeriod,
} from "../../domain/suggestion-dispatch-window.domain-service.js";
import type { RecentTodoCountReadModel } from "../read-models/suggestion-analysis.read-model.js";

export interface CountRecentSuggestionTodosQuery {
  readonly userId: UserId;
  readonly now: Temporal.Instant;
}

interface CountRecentSuggestionTodosDependencies {
  readonly todoCountReader: Pick<SingleTodoCountReaderPort, "countSingleTodos">;
  readonly timezoneReader: Pick<UserTimezoneReaderPort, "findStoredTimezone">;
}

// 기간은 저장된 시간대의 현지 날짜라 시간대를 읽은 뒤에 센다
export class CountRecentSuggestionTodosUseCase {
  readonly #dependencies: CountRecentSuggestionTodosDependencies;

  constructor(dependencies: CountRecentSuggestionTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: CountRecentSuggestionTodosQuery): Promise<RecentTodoCountReadModel> {
    const timeZone = resolveSuggestionTimeZone(
      await this.#dependencies.timezoneReader.findStoredTimezone(query.userId),
    );
    const recentTodoCount = await this.#dependencies.todoCountReader.countSingleTodos({
      userId: query.userId,
      ...suggestionAnalysisPeriod({ at: query.now, timeZone }),
    });
    return { timeZone, recentTodoCount };
  }
}
