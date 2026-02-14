import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';

export const createConsoleAnalytics = (): Analytics => ({
  trackEvent(eventName: string, params?: AnalyticsEventParams): void {
    params
      ? console.info('[Analytics] trackEvent:', eventName, params)
      : console.info('[Analytics] trackEvent:', eventName);
  },
  trackScreenView(screenName: string, params?: AnalyticsEventParams): void {
    params
      ? console.info('[Analytics] trackScreenView:', screenName, params)
      : console.info('[Analytics] trackScreenView:', screenName);
  },
  setUserId(userId: string | null): void {
    console.info('[Analytics] setUserId:', userId);
  },
  setUserProperties(properties: Record<string, string | number | boolean>): void {
    console.info('[Analytics] setUserProperties:', properties);
  },
});
