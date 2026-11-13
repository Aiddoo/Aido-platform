import type { SuggestionActionKind } from '@aido/api/vocabulary';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    ai_suggestion_acted: { action: SuggestionActionKind };
  }
}
