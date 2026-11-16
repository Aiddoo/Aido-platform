import type { AiSuggestionAnalysisState, SuggestionActionKind } from '@aido/api/vocabulary';

export type SuggestionActionSource = 'suggestions_screen' | 'report_preview';
export type SuggestionAnalysisSource = 'suggestions_screen' | 'feed_entry';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    ai_suggestion_acted: { action: SuggestionActionKind; source: SuggestionActionSource };
    ai_suggestions_viewed: { state: AiSuggestionAnalysisState; suggestion_count: number };
    ai_suggestion_analysis_requested: { source: SuggestionAnalysisSource };
  }
}
