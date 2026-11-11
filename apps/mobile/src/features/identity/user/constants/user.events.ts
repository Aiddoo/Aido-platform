declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
    profile_edited: { field: string };
  }
}

export {};
