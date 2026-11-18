import type { AiSuggestionAnalysisState } from "@aido/api/vocabulary";

import type { Suggestion } from "../../domain/suggestion.aggregate.js";

export interface SuggestionAnalysisReadModel {
  readonly state: AiSuggestionAnalysisState;
  readonly canRequestNow: boolean;
  readonly nextAnalysisAt: Temporal.Instant;
}

/** 저장된 시간대와 그 시간대 기준 분석 기간의 단건 할 일 수 */
export interface RecentTodoCountReadModel {
  readonly timeZone: string;
  readonly recentTodoCount: number;
}

export interface PendingSuggestionsReadModel {
  readonly suggestions: readonly Suggestion[];
  readonly analysis: SuggestionAnalysisReadModel;
}
