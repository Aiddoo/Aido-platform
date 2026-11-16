import { AI_SUGGESTION_LIMITS, type AiSuggestionAnalysisState } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { SuggestionAnalysisRun } from "./suggestion-analysis-run.entity.js";
import { suggestionDispatchLocalDate } from "./suggestion-dispatch-window.domain-service.js";

export interface SuggestionAnalysisFacts {
  readonly pendingCount: number;
  readonly hasAiConsent: boolean;
  readonly recentTodoCount: number;
  readonly run: SuggestionAnalysisRun | null;
  readonly now: Temporal.Instant;
  readonly timeZone: string;
}

export function hasEnoughRecentTodos(recentTodoCount: number): boolean {
  return AI_SUGGESTION_LIMITS.MIN_ANALYSIS_RECORDS <= recentTodoCount;
}

export function resolveSuggestionAnalysisState(
  facts: SuggestionAnalysisFacts,
): AiSuggestionAnalysisState {
  if (0 < facts.pendingCount) {
    return "HAS_SUGGESTIONS";
  }
  if (!facts.hasAiConsent) {
    return "NEEDS_AI_CONSENT";
  }
  if (!hasEnoughRecentTodos(facts.recentTodoCount)) {
    return "NEEDS_MORE_TODOS";
  }
  const { run } = facts;
  if (run == null) {
    return "WAITING_FOR_NEXT_RUN";
  }
  if (run.isRunning(facts.now)) {
    return "ANALYZING";
  }
  const today = suggestionDispatchLocalDate({ at: facts.now, timeZone: facts.timeZone });
  if (run.isFinishedOn(today)) {
    return match(run.outcome)
      .returnType<AiSuggestionAnalysisState>()
      .with("SUGGESTIONS_CREATED", () => "DONE_FOR_TODAY")
      .with("NO_PATTERN_FOUND", "NO_RECENT_TODOS", () => "NO_PATTERN_FOUND")
      .with(
        "AI_UNAVAILABLE",
        "SPEND_LIMIT_REACHED",
        "FAILED",
        "CONSENT_MISSING",
        "NOT_PREMIUM",
        null,
        () => "UNAVAILABLE_TODAY",
      )
      .exhaustive();
  }
  // 오늘 요청했지만 끝나지 않고 멈췄다. 그날 job key를 이미 써서 오늘은 다시 받을 수 없다
  if (run.isRequestedOn(today)) {
    return "UNAVAILABLE_TODAY";
  }
  return "WAITING_FOR_NEXT_RUN";
}

export function canRequestAnalysisNow(
  state: AiSuggestionAnalysisState,
  isOnDemandEnabled: boolean,
): boolean {
  return isOnDemandEnabled && state === "WAITING_FOR_NEXT_RUN";
}
