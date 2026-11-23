import type { RepeatingTodoTitleReaderPort } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { suggestionAnalysisPeriod } from "../domain/suggestion-dispatch-window.domain-service.js";
import type { SuggestionActivityReaderPort } from "./ports/suggestion-activity.reader.port.js";
import type { SuggestionContextReadModel } from "./read-models/suggestion-context.read-model.js";

/** 최근 응답 이력 기간. 이 안에 수락·거절한 활동은 다시 제안하지 않는다 */
const HISTORY_DAYS = 30;

interface SuggestionContextReaderDependencies {
  readonly activityReader: Pick<
    SuggestionActivityReaderPort,
    "findRecentTodos" | "findRecentResponded"
  >;
  readonly repeatingTitleReader: Pick<RepeatingTodoTitleReaderPort, "listActiveTitles">;
  readonly clock: ClockPort;
}

export class SuggestionContextReader {
  readonly #dependencies: SuggestionContextReaderDependencies;

  constructor(dependencies: SuggestionContextReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async build(owner: UserId, timezone: string): Promise<SuggestionContextReadModel> {
    const now = this.#dependencies.clock.now();
    const [todos, suggestionHistory, repeatingTitles] = await Promise.all([
      this.#dependencies.activityReader.findRecentTodos(
        owner,
        suggestionAnalysisPeriod({ at: now, timeZone: timezone }),
      ),
      this.#dependencies.activityReader.findRecentResponded(
        owner,
        now.subtract({ hours: 24 * HISTORY_DAYS }),
      ),
      this.#dependencies.repeatingTitleReader.listActiveTitles(owner),
    ]);
    return { todos, suggestionHistory, repeatingTitles };
  }
}
