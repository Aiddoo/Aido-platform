import type {
  SuggestionHistoryItem,
  TodoSummaryForAnalysis,
} from "../../domain/suggestions.constants.js";

export interface SuggestionContextReadModel {
  readonly todos: TodoSummaryForAnalysis[];
  readonly suggestionHistory: SuggestionHistoryItem[];
  readonly repeatingTitles: string[];
}
