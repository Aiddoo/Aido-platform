import type {
  SuggestionHistoryItem,
  TodoSummaryForAnalysis,
} from "../../domain/suggestion.constants.js";

export interface SuggestionContext {
  readonly todos: TodoSummaryForAnalysis[];
  readonly suggestionHistory: SuggestionHistoryItem[];
}
