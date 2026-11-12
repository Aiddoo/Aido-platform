import type { Analytics } from '@src/core/ports/analytics';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { PurchasesGateway } from '@src/core/ports/purchases-gateway';
import { getErrorMessage } from '@src/shared/errors';
import { withTimeout } from 'es-toolkit';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import { PURCHASES_SDK_CALL_TIMEOUT_MS } from '../constants/subscription.constants';

/** 운영 알림에서 구독 이벤트의 기기·앱 버전을 보도록 붙이는 값. 개인 정보가 아니다 */
export interface SubscriberAttributes {
  appVersion: string | null;
  deviceModel: string | null;
}

interface PurchasesSessionPorts {
  purchases: PurchasesGateway;
  logger: AppLogger;
  analytics: Pick<Analytics, 'getAnalyticsId'>;
  subscriberAttributes: SubscriberAttributes;
}

export class PurchasesSession {
  readonly #purchases: PurchasesGateway;
  readonly #logger: AppLogger;
  readonly #analytics: Pick<Analytics, 'getAnalyticsId'>;
  readonly #subscriberAttributes: SubscriberAttributes;
  #configured = false;
  /** logIn·logOut을 하나씩 돌린다. SDK의 로그인·로그아웃이 겹치면 늦게 끝난 쪽 사용자로 남는다 */
  #queue: Promise<void> = Promise.resolve();
  /** 가장 최근 요청의 번호. 시작 전에 더 새 요청이 오면 앞의 것은 건너뛴다 */
  #latestRequest = 0;

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

  logIn = (userId: string): Promise<void> =>
    this.#enqueue(async (isLatest) => {
      try {
        await withTimeout(() => this.#purchases.logIn(userId), PURCHASES_SDK_CALL_TIMEOUT_MS);
      } catch (error) {
        this.#logger.warn(SUBSCRIPTION_LOG_EVENT.PURCHASES_LOGIN_FAILED, {
          error: getErrorMessage(error),
        });
        return;
      }
      // 그 사이 로그아웃·다른 계정 로그인이 들어왔으면 이 사용자에게 속성을 붙이지 않는다
      if (!isLatest()) {
        return;
      }

      await Promise.all([this.#syncAnalyticsId(), this.#syncSubscriberAttributes()]);
    });

  logOut = (): Promise<void> =>
    this.#enqueue(async () => {
      try {
        await withTimeout(() => this.#purchases.logOut(), PURCHASES_SDK_CALL_TIMEOUT_MS);
      } catch (error) {
        this.#logger.warn(SUBSCRIPTION_LOG_EVENT.PURCHASES_LOGOUT_FAILED, {
          error: getErrorMessage(error),
        });
      }
    });

  #enqueue = (run: (isLatest: () => boolean) => Promise<void>): Promise<void> => {
    if (!this.#configured) {
      return Promise.resolve();
    }
    this.#latestRequest += 1;
    const request = this.#latestRequest;
    const isLatest = () => request === this.#latestRequest;
    // run은 실패를 기록만 하고 던지지 않아 앞 요청이 다음 요청을 막지 않는다
    const next = this.#queue.then(() => (isLatest() ? run(isLatest) : undefined));
    this.#queue = next;
    return next;
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
