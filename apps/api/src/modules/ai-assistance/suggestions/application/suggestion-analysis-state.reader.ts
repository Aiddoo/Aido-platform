import type { UserTimezoneReaderPort } from "#api/modules/identity/identity-settings.public";
import type { SingleTodoCountReaderPort } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ScheduledAiConsentReader } from "../../ai-generations/application/scheduled-ai-consent.reader.js";
import {
  canRequestAnalysisNow,
  resolveSuggestionAnalysisState,
} from "../domain/suggestion-analysis-state.domain-service.js";
import {
  nextSuggestionDispatchAt,
  resolveSuggestionTimeZone,
  suggestionAnalysisPeriod,
} from "../domain/suggestion-dispatch-window.domain-service.js";
import type { OnDemandSuggestionAnalysisConfigPort } from "./ports/on-demand-suggestion-analysis-config.port.js";
import type { SuggestionAnalysisRunRepositoryPort } from "./ports/suggestion-analysis-run.repository.port.js";
import type {
  RecentTodoCountReadModel,
  SuggestionAnalysisReadModel,
} from "./read-models/suggestion-analysis.read-model.js";

interface SuggestionAnalysisStateReaderDependencies {
  readonly runs: Pick<SuggestionAnalysisRunRepositoryPort, "findByUserId">;
  readonly todoCountReader: Pick<SingleTodoCountReaderPort, "countSingleTodos">;
  readonly scheduledAiConsent: Pick<ScheduledAiConsentReader, "find">;
  readonly timezoneReader: Pick<UserTimezoneReaderPort, "findStoredTimezone">;
  readonly onDemandConfig: Pick<OnDemandSuggestionAnalysisConfigPort, "isEnabled">;
  readonly clock: ClockPort;
}

export class SuggestionAnalysisStateReader {
  readonly #dependencies: SuggestionAnalysisStateReaderDependencies;

  constructor(dependencies: SuggestionAnalysisStateReaderDependencies) {
    this.#dependencies = dependencies;
  }

  // 지금 받기는 요청 판단에 읽은 값을 넘겨 시간대·할 일 수를 두 번 읽지 않는다
  async read(
    userId: UserId,
    pendingCount: number,
    recentTodos?: RecentTodoCountReadModel,
  ): Promise<SuggestionAnalysisReadModel> {
    const now = this.#dependencies.clock.now();
    const [run, consent, { timeZone, recentTodoCount }] = await Promise.all([
      this.#dependencies.runs.findByUserId(userId),
      this.#dependencies.scheduledAiConsent.find(userId),
      recentTodos ?? this.readRecentTodoCount(userId, now),
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
      canRequestNow: canRequestAnalysisNow(state, this.#dependencies.onDemandConfig.isEnabled),
      nextAnalysisAt: nextSuggestionDispatchAt({ at: now, timeZone, run }),
    };
  }

  // 기간은 저장된 시간대의 현지 날짜라 시간대를 읽은 뒤에 센다
  async readRecentTodoCount(
    userId: UserId,
    now: Temporal.Instant,
  ): Promise<RecentTodoCountReadModel> {
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
