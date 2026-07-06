import analytics from '@react-native-firebase/analytics';
import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';
import type { Logger } from '@src/core/ports/logger';

/**
 * Firebase Analytics 어댑터.
 *
 * `Analytics` 포트는 fire-and-forget `: void` 계약이므로 각 메서드는 async가 아니라
 * 내부에서 Promise를 `void ...catch()`로 삼켜 계약과 일치시킨다(floating promise 방지).
 */
export const createFirebaseAnalytics = (logger: Logger): Analytics => {
  const firebaseAnalytics = analytics();

  const swallow = (label: string, promise: Promise<unknown>, extra?: Record<string, unknown>) => {
    void promise.catch((e) => {
      logger.warn(`[FirebaseAnalytics] ${label} failed`, {
        ...extra,
        error: e instanceof Error ? e.message : String(e),
      });
    });
  };

  return {
    trackEvent(eventName: string, params?: AnalyticsEventParams): void {
      swallow('trackEvent', firebaseAnalytics.logEvent(eventName, params), { eventName });
    },
    trackScreenView(screenName: string, params?: AnalyticsEventParams): void {
      swallow(
        'trackScreenView',
        firebaseAnalytics.logScreenView({
          screen_name: screenName,
          screen_class: screenName,
          ...params,
        }),
        { screenName },
      );
    },
    setUserId(userId: string | null): void {
      swallow('setUserId', firebaseAnalytics.setUserId(userId));
    },
    setUserProperties(properties: Record<string, string | number | boolean>): void {
      for (const [key, value] of Object.entries(properties)) {
        swallow('setUserProperty', firebaseAnalytics.setUserProperty(key, String(value)), { key });
      }
    },
    resetData(): void {
      swallow('resetData', firebaseAnalytics.resetAnalyticsData());
    },
  };
};
