import type { Analytics } from '@src/core/ports/analytics';
import type { Logger } from '@src/core/ports/logger';
import type { PurchasesGateway } from '@src/core/ports/purchases-gateway';
import { getErrorMessage } from '@src/shared/errors';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';

/** 운영 알림에서 구독 이벤트의 기기·앱 버전을 보도록 붙이는 값. 개인 정보가 아니다 */
export interface SubscriberAttributes {
  appVersion: string | null;
  deviceModel: string | null;
}

interface PurchasesSessionPorts {
  purchases: PurchasesGateway;
  logger: Logger;
  analytics: Pick<Analytics, 'getAnalyticsId'>;
  subscriberAttributes: SubscriberAttributes;
}

export class PurchasesSession {
  readonly #purchases: PurchasesGateway;
  readonly #logger: Logger;
  readonly #analytics: Pick<Analytics, 'getAnalyticsId'>;
  readonly #subscriberAttributes: SubscriberAttributes;
  #configured = false;

  constructor({ purchases, logger, analytics, subscriberAttributes }: PurchasesSessionPorts) {
    this.#purchases = purchases;
    this.#logger = logger;
    this.#analytics = analytics;
    this.#subscriberAttributes = subscriberAttributes;
  }

  configure = (): void => {
    try {
      const result = this.#purchases.configure();
      if (result === 'missing-api-key') {
        this.#logger.warn(SUBSCRIPTION_LOG_EVENT.PURCHASES_CONFIGURE_SKIPPED);
        return;
      }
      this.#configured = true;
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.PURCHASES_CONFIGURE_FAILED, {
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
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.PURCHASES_LOGIN_FAILED, {
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
      await this.#purchases.logOut();
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.PURCHASES_LOGOUT_FAILED, {
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
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.PURCHASES_SUBSCRIBER_ATTRIBUTES_SYNC_FAILED, {
        error: getErrorMessage(error),
      });
    }
  };

  // 결제 공급자의 분석 연동이 구독 이벤트를 분석 ID로 귀속하므로 configure·logIn 직후마다 다시 설정한다.
  #syncAnalyticsId = async (): Promise<void> => {
    try {
      const analyticsId = await this.#analytics.getAnalyticsId();
      if (!analyticsId) {
        return;
      }

      await this.#purchases.setAnalyticsId(analyticsId);
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.PURCHASES_ANALYTICS_ID_SYNC_FAILED, {
        error: getErrorMessage(error),
      });
    }
  };
}
