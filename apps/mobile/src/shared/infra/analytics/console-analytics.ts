import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';

export const createConsoleAnalytics = (): Analytics => ({
  trackEvent(eventName: string, params?: AnalyticsEventParams): void {
    console.info('[Analytics] trackEvent:', eventName, params);
  },
  trackScreenView(screenName: string, params?: AnalyticsEventParams): void {
    console.info('[Analytics] trackScreenView:', screenName, params);
  },
  setUserId(userId: string | null): void {
    console.info('[Analytics] setUserId:', userId);
  },
  setUserProperties(properties: Record<string, string | number | boolean>): void {
    console.info('[Analytics] setUserProperties:', properties);
  },
});
