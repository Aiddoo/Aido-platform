declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    ai_suggestion_acted: { action: 'accept' | 'dismiss' };
  }
}

export {};
