import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CheckScheduledAiConsentUseCase } from "../../../ai-generations/application/use-cases/check-scheduled-ai-consent.use-case.js";
import {
  canRequestAnalysisNow,
  resolveSuggestionAnalysisState,
} from "../../domain/suggestion-analysis-state.domain-service.js";
import { nextSuggestionDispatchAt } from "../../domain/suggestion-dispatch-window.domain-service.js";
import type { OnDemandSuggestionAnalysisConfigPort } from "../ports/on-demand-suggestion-analysis-config.port.js";
import type { SuggestionAnalysisRunRepositoryPort } from "../ports/suggestion-analysis-run.repository.port.js";
import type {
  RecentTodoCountReadModel,
  SuggestionAnalysisReadModel,
} from "../read-models/suggestion-analysis.read-model.js";
import type { CountRecentSuggestionTodosUseCase } from "./count-recent-suggestion-todos.use-case.js";

export interface GetSuggestionAnalysisStateQuery {
  readonly userId: UserId;
  readonly pendingCount: number;
  // 지금 받기는 요청 판단에 읽은 값을 넘겨 시간대·할 일 수를 두 번 읽지 않는다
  readonly recentTodos?: RecentTodoCountReadModel;
}

interface GetSuggestionAnalysisStateDependencies {
  readonly runs: Pick<SuggestionAnalysisRunRepositoryPort, "findByUserId">;
  readonly countRecentTodos: Pick<CountRecentSuggestionTodosUseCase, "execute">;
  readonly scheduledAiConsent: Pick<CheckScheduledAiConsentUseCase, "execute">;
  readonly onDemandConfig: Pick<OnDemandSuggestionAnalysisConfigPort, "isEnabled">;
  readonly clock: ClockPort;
}

export class GetSuggestionAnalysisStateUseCase {
  readonly #dependencies: GetSuggestionAnalysisStateDependencies;

  constructor(dependencies: GetSuggestionAnalysisStateDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetSuggestionAnalysisStateQuery): Promise<SuggestionAnalysisReadModel> {
    const { userId, pendingCount, recentTodos } = query;
    const now = this.#dependencies.clock.now();
    const [run, consent, { timeZone, recentTodoCount }] = await Promise.all([
      this.#dependencies.runs.findByUserId(userId),
      this.#dependencies.scheduledAiConsent.execute(userId),
      recentTodos ?? this.#dependencies.countRecentTodos.execute({ userId, now }),
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
}
