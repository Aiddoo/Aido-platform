import type { AiSuggestionAnalysisState, SuggestionActionKind } from '@aido/api/vocabulary';
import type { AnalyticsSource } from '@src/shared/analytics/event-vocabulary';

/** 제안을 처리한 곳. 수락 시트 route의 `source` param도 이 값이다 */
export const SUGGESTION_ACTION_SOURCES = ['suggestions_screen', 'report_preview'] as const;
export type SuggestionActionSource = (typeof SUGGESTION_ACTION_SOURCES)[number];

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    ai_suggestion_acted: {
      action: SuggestionActionKind;
      source: AnalyticsSource<SuggestionActionSource>;
    };
    ai_suggestions_viewed: { state: AiSuggestionAnalysisState; suggestion_count: number };
    ai_suggestion_analysis_requested: { source: AnalyticsSource<'suggestions_screen'> };
  }
}
