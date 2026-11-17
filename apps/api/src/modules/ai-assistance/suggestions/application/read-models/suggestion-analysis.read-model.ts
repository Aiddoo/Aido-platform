import type { AiSuggestionAnalysisState } from "@aido/api/vocabulary";

import type { Suggestion } from "../../domain/suggestion.aggregate.js";

export interface SuggestionAnalysisReadModel {
  readonly state: AiSuggestionAnalysisState;
  readonly canRequestNow: boolean;
  readonly nextAnalysisAt: Temporal.Instant;
}

export interface PendingSuggestionsReadModel {
  readonly suggestions: readonly Suggestion[];
  readonly analysis: SuggestionAnalysisReadModel;
}
