import {
  getAnalytics,
  resetAnalyticsData,
  setUserId,
  setUserProperty,
} from '@react-native-firebase/analytics';
import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';
import type { Logger } from '@src/core/ports/logger';

/**
 * Firebase Analytics 어댑터.
 *
 * `Analytics` 포트는 fire-and-forget `: void` 계약이다. RNFirebase v26의 modular
 * `logEvent`는 내부 native Promise를 반환하지 않으므로, 이벤트만 instance method로
 * 호출해 동기 검증 예외와 native Promise rejection을 모두 포트 안에서 격리한다.
 */
export const createFirebaseAnalytics = (logger: Logger): Analytics => {
  const firebaseAnalytics = getAnalytics();

  const warn = (label: string, error: unknown, extra?: Record<string, unknown>) => {
    logger.warn(`[FirebaseAnalytics] ${label} failed`, {
      ...extra,
      error: error instanceof Error ? error.message : String(error),
    });
  };

  const invokeAsync = (
    label: string,
    operation: () => Promise<unknown>,
    extra?: Record<string, unknown>,
  ): void => {
    try {
      void operation().catch((error) => {
        warn(label, error, extra);
      });
    } catch (error) {
      // RNFirebase의 인자 검증은 Promise를 만들기 전에 동기 예외를 던질 수 있다.
      warn(label, error, extra);
    }
  };

  return {
    trackEvent(eventName: string, params?: AnalyticsEventParams): void {
      invokeAsync('trackEvent', () => firebaseAnalytics.logEvent(eventName, params), { eventName });
    },
    trackScreenView(screenName: string, params?: AnalyticsEventParams): void {
      invokeAsync(
        'trackScreenView',
        () =>
          firebaseAnalytics.logEvent('screen_view', {
            screen_name: screenName,
            screen_class: screenName,
            ...params,
          }),
        { screenName },
      );
    },
    setUserId(userId: string | null): void {
      invokeAsync('setUserId', () => setUserId(firebaseAnalytics, userId));
    },
    setUserProperties(properties: Record<string, string | number | boolean>): void {
      for (const [key, value] of Object.entries(properties)) {
        invokeAsync(
          'setUserProperty',
          () => setUserProperty(firebaseAnalytics, key, String(value)),
          { key },
        );
      }
    },
    resetData(): void {
      invokeAsync('resetData', () => resetAnalyticsData(firebaseAnalytics));
    },
  };
};
