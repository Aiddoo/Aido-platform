import type { UserTimezoneReaderPort } from "#api/modules/identity/identity-settings.public";
import type { SingleTodoCountReaderPort } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ScheduledAiConsentReader } from "../../generation/application/scheduled-ai-consent.reader.js";
import {
  canRequestAnalysisNow,
  resolveSuggestionAnalysisState,
} from "../domain/suggestion-analysis-state.domain-service.js";
import {
  nextSuggestionDispatchAt,
  resolveSuggestionTimeZone,
  suggestionAnalysisPeriod,
} from "../domain/suggestion-dispatch-window.domain-service.js";
import type { SuggestionAnalysisRunRepositoryPort } from "./ports/suggestion-analysis-run.repository.port.js";
import type { SuggestionAnalysisSettingsPort } from "./ports/suggestion-analysis-settings.port.js";
import type { SuggestionAnalysisReadModel } from "./read-models/suggestion-analysis.read-model.js";

interface SuggestionAnalysisStateReaderDependencies {
  readonly runs: Pick<SuggestionAnalysisRunRepositoryPort, "findByUserId">;
  readonly todoCountReader: Pick<SingleTodoCountReaderPort, "countSingleTodos">;
  readonly scheduledAiConsent: Pick<ScheduledAiConsentReader, "find">;
  readonly timezoneReader: Pick<UserTimezoneReaderPort, "findStoredTimezone">;
  readonly settings: Pick<SuggestionAnalysisSettingsPort, "onDemandEnabled">;
  readonly clock: ClockPort;
}

export class SuggestionAnalysisStateReader {
  readonly #dependencies: SuggestionAnalysisStateReaderDependencies;

  constructor(dependencies: SuggestionAnalysisStateReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async read(userId: UserId, pendingCount: number): Promise<SuggestionAnalysisReadModel> {
    const now = this.#dependencies.clock.now();
    const [run, consent, { timeZone, recentTodoCount }] = await Promise.all([
      this.#dependencies.runs.findByUserId(userId),
      this.#dependencies.scheduledAiConsent.find(userId.value),
      this.#readRecentTodos(userId, now),
    ]);
    const state = resolveSuggestionAnalysisState({
      pendingCount,
      hasAiConsent: consent.allowed,
      recentTodoCount,
      run,
      now,
      timeZone,
    });
    return {
      state,
      recentTodoCount,
      canRequestNow: canRequestAnalysisNow(state, this.#dependencies.settings.onDemandEnabled),
      lastAnalyzedAt: run?.finishedAt ?? null,
      nextAnalysisAt: nextSuggestionDispatchAt({ at: now, timeZone }),
    };
  }

  // 기간은 저장된 시간대의 현지 날짜라 시간대를 읽은 뒤에 센다
  async #readRecentTodos(userId: UserId, now: Temporal.Instant) {
    const timeZone = resolveSuggestionTimeZone(
      await this.#dependencies.timezoneReader.findStoredTimezone(userId),
    );
    const recentTodoCount = await this.#dependencies.todoCountReader.countSingleTodos({
      userId,
      ...suggestionAnalysisPeriod({ at: now, timeZone }),
    });
    return { timeZone, recentTodoCount };
  }
}
