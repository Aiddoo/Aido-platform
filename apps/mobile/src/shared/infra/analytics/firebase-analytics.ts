import {
  getAnalytics,
  getAppInstanceId,
  resetAnalyticsData,
  setDefaultEventParameters,
  setUserId,
  setUserProperties,
  setUserProperty,
} from '@react-native-firebase/analytics';
import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';
import type { Logger } from '@src/core/ports/logger';
import { getErrorMessage } from '@src/shared/errors';
import {
  CLEARED_USER_PROPERTIES,
  INTERNAL_TRAFFIC_EVENT_PARAMETERS,
  type UserPropertyMap,
} from '@src/shared/observability/telemetry-keys';

import { FIREBASE_ANALYTICS_LOG_EVENT } from './firebase-analytics-log-events';

const warn = (
  logger: Logger,
  logEvent: string,
  error: unknown,
  extra?: Record<string, unknown>,
) => {
  logger.warn(logEvent, {
    ...extra,
    error: getErrorMessage(error),
  });
};

/** fire-and-forget 호출의 동기 예외와 Promise rejection을 모두 로그로만 남긴다 */
const invokeAsync = (
  logger: Logger,
  logEvent: string,
  operation: () => Promise<unknown>,
  extra?: Record<string, unknown>,
): void => {
  try {
    operation().catch((error) => {
      warn(logger, logEvent, error, extra);
    });
  } catch (error) {
    // RNFirebase의 인자 검증은 Promise를 만들기 전에 동기 예외를 던질 수 있다.
    warn(logger, logEvent, error, extra);
  }
};

/**
 * Firebase Analytics 어댑터.
 *
 * `Analytics` 포트는 fire-and-forget `: void` 계약이다. RNFirebase v26의 modular
 * `logEvent`는 내부 native Promise를 반환하지 않으므로, 이벤트만 instance method로
 * 호출해 동기 검증 예외와 native Promise rejection을 모두 포트 안에서 격리한다.
 */
export const createFirebaseAnalytics = (logger: Logger): Analytics => {
  const firebaseAnalytics = getAnalytics();

  return {
    trackEvent(eventName: string, params?: AnalyticsEventParams): void {
      invokeAsync(
        logger,
        FIREBASE_ANALYTICS_LOG_EVENT.TRACK_EVENT_FAILED,
        () => firebaseAnalytics.logEvent(eventName, params),
        { eventName },
      );
    },
    trackScreenView(screenName: string, params?: AnalyticsEventParams): void {
      invokeAsync(
        logger,
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
      invokeAsync(logger, FIREBASE_ANALYTICS_LOG_EVENT.SET_USER_ID_FAILED, () =>
        setUserId(firebaseAnalytics, userId),
      );
    },
    setUserProperties(properties: UserPropertyMap): void {
      for (const [key, value] of Object.entries(properties)) {
        invokeAsync(
          logger,
          FIREBASE_ANALYTICS_LOG_EVENT.SET_USER_PROPERTY_FAILED,
          () => setUserProperty(firebaseAnalytics, key, String(value)),
          { key },
        );
      }
    },
    clearUser(): void {
      invokeAsync(logger, FIREBASE_ANALYTICS_LOG_EVENT.SET_USER_ID_FAILED, () =>
        setUserId(firebaseAnalytics, null),
      );
      invokeAsync(logger, FIREBASE_ANALYTICS_LOG_EVENT.CLEAR_USER_FAILED, () =>
        setUserProperties(firebaseAnalytics, CLEARED_USER_PROPERTIES),
      );
    },
    resetData(): void {
      invokeAsync(logger, FIREBASE_ANALYTICS_LOG_EVENT.RESET_DATA_FAILED, () =>
        resetAnalyticsData(firebaseAnalytics),
      );
    },
    getAppInstanceId(): Promise<string | null> {
      return getAppInstanceId(firebaseAnalytics);
    },
  };
};

/**
 * 개발·프리뷰 빌드는 JS 이벤트를 콘솔로만 남기지만, 네이티브 SDK는 같은 GA 속성으로
 * 자동 수집 이벤트(`session_start`·`user_engagement`·`in_app_purchase` 등)를 보낸다.
 * 이후 모든 이벤트에 `traffic_type=internal`을 붙여 GA "내부 트래픽" 필터로 제외한다.
 * JS가 뜨기 전 첫 실행의 `first_open`에는 붙지 않는다.
 */
export const markFirebaseTrafficAsInternal = (logger: Logger): void => {
  invokeAsync(logger, FIREBASE_ANALYTICS_LOG_EVENT.SET_DEFAULT_EVENT_PARAMETERS_FAILED, () =>
    setDefaultEventParameters(getAnalytics(), INTERNAL_TRAFFIC_EVENT_PARAMETERS),
  );
};
