import analytics from '@react-native-firebase/analytics';
import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';

export const createFirebaseAnalytics = (): Analytics => {
  const firebaseAnalytics = analytics();

  return {
    async trackEvent(eventName: string, params?: AnalyticsEventParams): Promise<void> {
      await firebaseAnalytics.logEvent(eventName, params).catch((e) => {
        if (__DEV__) console.warn('[FirebaseAnalytics] trackEvent failed:', e);
      });
    },
    async trackScreenView(screenName: string, params?: AnalyticsEventParams): Promise<void> {
      await firebaseAnalytics
        .logScreenView({
          screen_name: screenName,
          screen_class: screenName,
          ...params,
        })
        .catch((e) => {
          if (__DEV__) console.warn('[FirebaseAnalytics] trackScreenView failed:', e);
        });
    },
    async setUserId(userId: string | null): Promise<void> {
      await firebaseAnalytics.setUserId(userId).catch((e) => {
        if (__DEV__) console.warn('[FirebaseAnalytics] setUserId failed:', e);
      });
    },
    async setUserProperties(properties: Record<string, string | number | boolean>): Promise<void> {
      for (const [key, value] of Object.entries(properties)) {
        await firebaseAnalytics.setUserProperty(key, String(value)).catch((e) => {
          if (__DEV__) console.warn('[FirebaseAnalytics] setUserProperty failed:', e);
        });
      }
    },
    async resetData(): Promise<void> {
      await firebaseAnalytics.resetAnalyticsData().catch((e) => {
        if (__DEV__) console.warn('[FirebaseAnalytics] resetData failed:', e);
      });
    },
  };
};
