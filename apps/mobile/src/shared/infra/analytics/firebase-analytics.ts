import {
  getAnalytics,
  resetAnalyticsData,
  setUserId,
  setUserProperty,
} from '@react-native-firebase/analytics';
import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';
import type { Logger } from '@src/core/ports/logger';

import { FIREBASE_ANALYTICS_LOG_EVENT } from './firebase-analytics-log-events';

/**
 * Firebase Analytics 어댑터.
 *
 * `Analytics` 포트는 fire-and-forget `: void` 계약이다. RNFirebase v26의 modular
 * `logEvent`는 내부 native Promise를 반환하지 않으므로, 이벤트만 instance method로
 * 호출해 동기 검증 예외와 native Promise rejection을 모두 포트 안에서 격리한다.
 */
export const createFirebaseAnalytics = (logger: Logger): Analytics => {
  const firebaseAnalytics = getAnalytics();

  const warn = (logEvent: string, error: unknown, extra?: Record<string, unknown>) => {
    logger.warn(logEvent, {
      ...extra,
      error: error instanceof Error ? error.message : String(error),
    });
  };

  const invokeAsync = (
    logEvent: string,
    operation: () => Promise<unknown>,
    extra?: Record<string, unknown>,
  ): void => {
    try {
      operation().catch((error) => {
        warn(logEvent, error, extra);
      });
    } catch (error) {
      // RNFirebase의 인자 검증은 Promise를 만들기 전에 동기 예외를 던질 수 있다.
      warn(logEvent, error, extra);
    }
  };

  return {
    trackEvent(eventName: string, params?: AnalyticsEventParams): void {
      invokeAsync(
        FIREBASE_ANALYTICS_LOG_EVENT.TRACK_EVENT_FAILED,
        () => firebaseAnalytics.logEvent(eventName, params),
        { eventName },
      );
    },
    trackScreenView(screenName: string, params?: AnalyticsEventParams): void {
      invokeAsync(
        FIREBASE_ANALYTICS_LOG_EVENT.TRACK_SCREEN_VIEW_FAILED,
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
      invokeAsync(FIREBASE_ANALYTICS_LOG_EVENT.SET_USER_ID_FAILED, () =>
        setUserId(firebaseAnalytics, userId),
      );
    },
    setUserProperties(properties: Record<string, string | number | boolean>): void {
      for (const [key, value] of Object.entries(properties)) {
        invokeAsync(
          FIREBASE_ANALYTICS_LOG_EVENT.SET_USER_PROPERTY_FAILED,
          () => setUserProperty(firebaseAnalytics, key, String(value)),
          { key },
        );
      }
    },
    resetData(): void {
      invokeAsync(FIREBASE_ANALYTICS_LOG_EVENT.RESET_DATA_FAILED, () =>
        resetAnalyticsData(firebaseAnalytics),
      );
    },
  };
};
