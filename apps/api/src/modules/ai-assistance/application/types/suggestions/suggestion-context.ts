import type {
  RecordedActivityEvidence,
  SuggestionHistoryItem,
  TodoSummaryForAnalysis,
} from "../../../domain/types/suggestions/ai-suggestion.types.js";

/**
 * AI 제안 생성을 위한 사전 계산된 컨텍스트
 */
export interface SuggestionContext {
  readonly todos: TodoSummaryForAnalysis[];
  readonly recordedActivities?: readonly RecordedActivityEvidence[];
  readonly dayCompletionRates: string;
  readonly timeCompletionRates: string;
  readonly categoryRates: string;
  readonly streak: string;
  readonly missingRoutines: string[];
  readonly weather: string | null;
  readonly currentDate: string;
  readonly weeklyReportInsight: string | null;
  readonly suggestionHistory: SuggestionHistoryItem[];
}
