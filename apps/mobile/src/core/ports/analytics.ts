export type AnalyticsEventParams = Record<string, unknown>;

export interface Analytics {
  trackEvent(eventName: string, params?: AnalyticsEventParams): void;
  trackScreenView(screenName: string, params?: AnalyticsEventParams): void;
  setUserId(userId: string | null): void;
  setUserProperties(properties: Record<string, string | number | boolean>): void;
  resetData(): void;
}
