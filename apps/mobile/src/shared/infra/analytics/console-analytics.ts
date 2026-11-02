import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';
import type { UserPropertyMap } from '@src/shared/observability/telemetry-keys';

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
  setUserProperties(properties: UserPropertyMap): void {
    console.info('[Analytics] setUserProperties:', properties);
  },
  clearUser(): void {
    console.info('[Analytics] clearUser');
  },
  resetData(): void {
    console.info('[Analytics] resetData');
  },
  getAppInstanceId(): Promise<string | null> {
    return Promise.resolve(null);
  },
});
