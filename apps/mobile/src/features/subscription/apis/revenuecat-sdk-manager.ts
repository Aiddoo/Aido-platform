import type { Analytics } from '@src/core/ports/analytics';
import type { Logger } from '@src/core/ports/logger';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';

/**
 * RevenueCat SDK 라이프사이클 관리
 *
 * SDK 초기화, 사용자 동기화만 담당.
 * RevenueCatProvider에서만 사용한다.
 */
export class RevenueCatSdkManager {
  readonly #logger: Logger;
  readonly #analytics: Analytics;
  #configured = false;

  constructor(logger: Logger, analytics: Analytics) {
    this.#logger = logger;
    this.#analytics = analytics;
  }

  configure = (apiKey: string): void => {
    if (!apiKey) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_CONFIGURE_SKIPPED);
      return;
    }

    try {
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.WARN);
      }
      Purchases.configure({ apiKey });
      this.#configured = true;
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_CONFIGURE_FAILED, {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    this.#syncFirebaseAppInstanceId();
    this.#syncSubscriberAttributes();
  };

  logIn = async (userId: string): Promise<void> => {
    if (!this.#configured) {
      return;
    }

    try {
      await Purchases.logIn(userId);
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_LOGIN_FAILED, {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    await Promise.all([this.#syncFirebaseAppInstanceId(), this.#syncSubscriberAttributes()]);
  };

  logOut = async (): Promise<void> => {
    if (!this.#configured) {
      return;
    }

    try {
      const isAnonymous = await Purchases.isAnonymous();
      if (isAnonymous) {
        return;
      }

      await Purchases.logOut();
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_LOGOUT_FAILED, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  isConfigured = (): boolean => {
    return this.#configured;
  };

  // 운영 알림에서 구독 이벤트의 기기·앱 버전을 보도록 붙인다. 개인 정보가 아니며 바뀐 사용자에게도 다시 설정한다.
  #syncSubscriberAttributes = async (): Promise<void> => {
    try {
      await Purchases.setAttributes({
        appVersion: Application.nativeApplicationVersion,
        deviceModel: Device.modelName,
      });
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_SUBSCRIBER_ATTRIBUTES_SYNC_FAILED, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // RevenueCat Firebase 연동은 구독 이벤트를 앱 인스턴스 ID로 귀속하므로 configure·logIn 직후마다 다시 설정한다.
  #syncFirebaseAppInstanceId = async (): Promise<void> => {
    try {
      const appInstanceId = await this.#analytics.getAppInstanceId();
      if (!appInstanceId) {
        return;
      }

      await Purchases.setFirebaseAppInstanceID(appInstanceId);
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_FIREBASE_APP_INSTANCE_ID_SYNC_FAILED, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
