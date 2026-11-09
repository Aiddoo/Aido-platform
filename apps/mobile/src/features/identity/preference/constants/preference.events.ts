declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    settings_changed: { setting: string; value: string };
  }
}

export {};
