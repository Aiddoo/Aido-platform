import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";

import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { SuggestionActivityReaderPort } from "./ports/suggestion-activity.reader.port.js";
import type { SuggestionContext } from "./read-models/suggestion-context.read-model.js";

/** 최근 응답 이력 기간. 이 안에 수락·거절한 활동은 다시 제안하지 않는다 */
const HISTORY_DAYS = 30;

interface SuggestionContextReaderDependencies {
  readonly activityReader: Pick<
    SuggestionActivityReaderPort,
    "findRecentTodos" | "findRecentResponded"
  >;
  readonly clock: ClockPort;
}

export class SuggestionContextReader {
  readonly #dependencies: SuggestionContextReaderDependencies;

  constructor(dependencies: SuggestionContextReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async build(userId: string, timezone: string): Promise<SuggestionContext> {
    const now = this.#dependencies.clock.now();
    // UTC 일수라 일광 절약 없이 24시간 단위다
    const daysAgo = (days: number) => instantToDate(now.subtract({ hours: 24 * days }));
    const owner = UserId.reconstitute(userId);
    const [todos, suggestionHistory] = await Promise.all([
      this.#dependencies.activityReader.findRecentTodos(
        owner,
        daysAgo(7 * AI_SUGGESTION_LIMITS.ANALYSIS_WEEKS),
        instantToDate(now),
        timezone,
      ),
      this.#dependencies.activityReader.findRecentResponded(owner, daysAgo(HISTORY_DAYS)),
    ]);
    return { todos, suggestionHistory };
  }
}
