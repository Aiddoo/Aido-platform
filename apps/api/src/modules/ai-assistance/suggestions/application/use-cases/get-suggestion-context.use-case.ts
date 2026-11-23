import type { RepeatingTodoTitleReaderPort } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { suggestionAnalysisPeriod } from "../../domain/suggestion-dispatch-window.domain-service.js";
import type { SuggestionActivityReaderPort } from "../ports/suggestion-activity.reader.port.js";
import type { SuggestionContextReadModel } from "../read-models/suggestion-context.read-model.js";

/** 최근 응답 이력 기간. 이 안에 수락·거절한 활동은 다시 제안하지 않는다 */
const HISTORY_DAYS = 30;

export interface GetSuggestionContextQuery {
  readonly userId: UserId;
  readonly timezone: string;
}

interface GetSuggestionContextDependencies {
  readonly activityReader: Pick<
    SuggestionActivityReaderPort,
    "findRecentTodos" | "findRecentResponded"
  >;
  readonly repeatingTitleReader: Pick<RepeatingTodoTitleReaderPort, "listActiveTitles">;
  readonly clock: ClockPort;
}

export class GetSuggestionContextUseCase {
  readonly #dependencies: GetSuggestionContextDependencies;

  constructor(dependencies: GetSuggestionContextDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetSuggestionContextQuery): Promise<SuggestionContextReadModel> {
    const now = this.#dependencies.clock.now();
    const [todos, suggestionHistory, repeatingTitles] = await Promise.all([
      this.#dependencies.activityReader.findRecentTodos(
        query.userId,
        suggestionAnalysisPeriod({ at: now, timeZone: query.timezone }),
      ),
      this.#dependencies.activityReader.findRecentResponded(
        query.userId,
        now.subtract({ hours: 24 * HISTORY_DAYS }),
      ),
      this.#dependencies.repeatingTitleReader.listActiveTitles(query.userId),
    ]);
    return { todos, suggestionHistory, repeatingTitles };
  }
}
