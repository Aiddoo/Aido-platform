import {
  getAnalytics,
  getAppInstanceId,
  resetAnalyticsData,
  setDefaultEventParameters,
  setUserId,
  setUserProperties,
  setUserProperty,
} from '@react-native-firebase/analytics';
import {
  CLEARED_USER_PROPERTIES,
  INTERNAL_TRAFFIC_EVENT_PARAMETERS,
  type UserPropertyMap,
} from '@src/core/observability/telemetry-keys';
import type { TelemetryData } from '@src/core/observability/telemetry-keys';
import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';
import type { AppLogger } from '@src/core/ports/app-logger';
import { getErrorMessage } from '@src/shared/errors';

import { FIREBASE_ANALYTICS_LOG_EVENT } from './firebase-analytics-log-events';

function warn(logger: AppLogger, logEvent: string, error: unknown, extra?: TelemetryData) {
  logger.warn(logEvent, {
    ...extra,
    error: getErrorMessage(error),
  });
}

/** fire-and-forget 호출의 동기 예외와 Promise rejection을 모두 로그로만 남긴다 */
function invokeAsync(
  logger: AppLogger,
  logEvent: string,
  operation: () => Promise<unknown>,
  extra?: TelemetryData,
): void {
  try {
    operation().catch((error) => {
      warn(logger, logEvent, error, extra);
    });
  } catch (error) {
    // RNFirebase의 인자 검증은 Promise를 만들기 전에 동기 예외를 던질 수 있다.
    warn(logger, logEvent, error, extra);
  }
}

/** RNFirebase v26 modular `logEvent`는 native Promise를 반환하지 않아 instance method로 호출해 동기 예외와 rejection을 포트 안에서 격리한다 */
export function createFirebaseAnalytics(logger: AppLogger): Analytics {
  const firebaseAnalytics = getAnalytics();

  return {
    trackEvent: (eventName: string, params?: AnalyticsEventParams): void => {
      invokeAsync(
        logger,
        FIREBASE_ANALYTICS_LOG_EVENT.TRACK_EVENT_FAILED,
        () => firebaseAnalytics.logEvent(eventName, params),
        { eventName },
      );
    },
    trackScreenView: (screenName: string, params?: AnalyticsEventParams): void => {
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
    setUserId: (userId: string | null): void => {
      invokeAsync(logger, FIREBASE_ANALYTICS_LOG_EVENT.SET_USER_ID_FAILED, () =>
        setUserId(firebaseAnalytics, userId),
      );
    },
    setUserProperties: (properties: UserPropertyMap): void => {
      for (const [key, value] of Object.entries(properties)) {
        invokeAsync(
          logger,
          FIREBASE_ANALYTICS_LOG_EVENT.SET_USER_PROPERTY_FAILED,
          () => setUserProperty(firebaseAnalytics, key, String(value)),
          { key },
        );
      }
    },
    clearUser: (): void => {
      invokeAsync(logger, FIREBASE_ANALYTICS_LOG_EVENT.SET_USER_ID_FAILED, () =>
        setUserId(firebaseAnalytics, null),
      );
      invokeAsync(logger, FIREBASE_ANALYTICS_LOG_EVENT.CLEAR_USER_FAILED, () =>
        setUserProperties(firebaseAnalytics, CLEARED_USER_PROPERTIES),
      );
    },
    resetData: (): void => {
      invokeAsync(logger, FIREBASE_ANALYTICS_LOG_EVENT.RESET_DATA_FAILED, () =>
        resetAnalyticsData(firebaseAnalytics),
      );
    },
    getAnalyticsId: (): Promise<string | null> => {
      return getAppInstanceId(firebaseAnalytics);
    },
  };
}

/** 네이티브 SDK는 개발·프리뷰에서도 자동 수집 이벤트를 GA로 보내므로 traffic_type=internal로 걸러낸다 (JS 전 첫 실행의 first_open은 제외) */
export function markFirebaseTrafficAsInternal(logger: AppLogger): void {
  invokeAsync(logger, FIREBASE_ANALYTICS_LOG_EVENT.SET_DEFAULT_EVENT_PARAMETERS_FAILED, () =>
    setDefaultEventParameters(getAnalytics(), INTERNAL_TRAFFIC_EVENT_PARAMETERS),
  );
}
