import analytics from '@react-native-firebase/analytics';
import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';
import type { Logger } from '@src/core/ports/logger';

export const createFirebaseAnalytics = (logger: Logger): Analytics => {
  const firebaseAnalytics = analytics();

  return {
    async trackEvent(eventName: string, params?: AnalyticsEventParams): Promise<void> {
      await firebaseAnalytics.logEvent(eventName, params).catch((e) => {
        logger.warn('[FirebaseAnalytics] trackEvent failed', {
          eventName,
          error: e instanceof Error ? e.message : String(e),
        });
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
          logger.warn('[FirebaseAnalytics] trackScreenView failed', {
            screenName,
            error: e instanceof Error ? e.message : String(e),
          });
        });
    },
    async setUserId(userId: string | null): Promise<void> {
      await firebaseAnalytics.setUserId(userId).catch((e) => {
        logger.warn('[FirebaseAnalytics] setUserId failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      });
    },
    async setUserProperties(properties: Record<string, string | number | boolean>): Promise<void> {
      for (const [key, value] of Object.entries(properties)) {
        await firebaseAnalytics.setUserProperty(key, String(value)).catch((e) => {
          logger.warn('[FirebaseAnalytics] setUserProperty failed', {
            key,
            error: e instanceof Error ? e.message : String(e),
          });
        });
      }
    },
    async resetData(): Promise<void> {
      await firebaseAnalytics.resetAnalyticsData().catch((e) => {
        logger.warn('[FirebaseAnalytics] resetData failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      });
    },
  };
};
