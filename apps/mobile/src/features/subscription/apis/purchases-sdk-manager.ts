import type { Analytics } from '@src/core/ports/analytics';
import type { Logger } from '@src/core/ports/logger';
import type { PurchasesGateway } from '@src/core/ports/purchases';
import { getErrorMessage } from '@src/shared/errors';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';

/** 운영 알림에서 구독 이벤트의 기기·앱 버전을 보도록 붙이는 값. 개인 정보가 아니다 */
export interface SubscriberAttributes {
  appVersion: string | null;
  deviceModel: string | null;
}

interface PurchasesSdkManagerDependencies {
  purchases: PurchasesGateway;
  logger: Logger;
  analytics: Analytics;
  subscriberAttributes: SubscriberAttributes;
  isDebugLogEnabled: boolean;
}

/**
 * 결제 SDK 라이프사이클 관리
 *
 * SDK 초기화, 사용자 동기화만 담당.
 * RevenueCatProvider에서만 사용한다.
 */
export class PurchasesSdkManager {
  readonly #purchases: PurchasesGateway;
  readonly #logger: Logger;
  readonly #analytics: Analytics;
  readonly #subscriberAttributes: SubscriberAttributes;
  readonly #isDebugLogEnabled: boolean;
  #configured = false;

  constructor({
    purchases,
    logger,
    analytics,
    subscriberAttributes,
    isDebugLogEnabled,
  }: PurchasesSdkManagerDependencies) {
    this.#purchases = purchases;
    this.#logger = logger;
    this.#analytics = analytics;
    this.#subscriberAttributes = subscriberAttributes;
    this.#isDebugLogEnabled = isDebugLogEnabled;
  }

  configure = (apiKey: string): void => {
    if (!apiKey) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_CONFIGURE_SKIPPED);
      return;
    }

    try {
      this.#purchases.configure(apiKey, { isDebugLogEnabled: this.#isDebugLogEnabled });
      this.#configured = true;
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_CONFIGURE_FAILED, {
        error: getErrorMessage(error),
      });
      return;
    }

    this.#syncAnalyticsId();
    this.#syncSubscriberAttributes();
  };

  logIn = async (userId: string): Promise<void> => {
    if (!this.#configured) {
      return;
    }

    try {
      await this.#purchases.logIn(userId);
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_LOGIN_FAILED, {
        error: getErrorMessage(error),
      });
      return;
    }

    await Promise.all([this.#syncAnalyticsId(), this.#syncSubscriberAttributes()]);
  };

  logOut = async (): Promise<void> => {
    if (!this.#configured) {
      return;
    }

    try {
      const isAnonymous = await this.#purchases.isAnonymous();
      if (isAnonymous) {
        return;
      }

      await this.#purchases.logOut();
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_LOGOUT_FAILED, {
        error: getErrorMessage(error),
      });
    }
  };

  isConfigured = (): boolean => {
    return this.#configured;
  };

  // 바뀐 사용자에게도 다시 설정한다
  #syncSubscriberAttributes = async (): Promise<void> => {
    try {
      await this.#purchases.setAttributes({ ...this.#subscriberAttributes });
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_SUBSCRIBER_ATTRIBUTES_SYNC_FAILED, {
        error: getErrorMessage(error),
      });
    }
  };

  // RevenueCat Firebase 연동은 구독 이벤트를 앱 인스턴스 ID로 귀속하므로 configure·logIn 직후마다 다시 설정한다.
  #syncAnalyticsId = async (): Promise<void> => {
    try {
      const analyticsId = await this.#analytics.getAnalyticsId();
      if (!analyticsId) {
        return;
      }

      await this.#purchases.setAnalyticsId(analyticsId);
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.REVENUECAT_FIREBASE_APP_INSTANCE_ID_SYNC_FAILED, {
        error: getErrorMessage(error),
      });
    }
  };
}
