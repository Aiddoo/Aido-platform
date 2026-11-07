import { err, ok, type Result } from '@src/core/errors/result';
import type { Logger } from '@src/core/ports/logger';
import type { PurchasesGateway } from '@src/core/ports/purchases-gateway';
import { getErrorMessage } from '@src/shared/errors';
import { noop } from 'es-toolkit';
import { match } from 'ts-pattern';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import { CustomerInfoPolicy } from '../domains/customer-info.model';
import { type SubscriptionError, SubscriptionErrors } from '../domains/subscription.error';
import { type CustomerInfo, type SubscriptionStore } from '../schemas/customer-info.schema';
import type { SubscriptionOffering } from '../schemas/subscription.schema';
import type { PurchasesSession } from './purchases-session';
import { toSubscriptionError } from './subscription-error.mapper';
import { toCustomerInfo, toSubscriptionOffering } from './subscription.mapper';

export class SubscriptionService {
  readonly #session: Pick<PurchasesSession, 'isConfigured'>;
  readonly #purchases: PurchasesGateway;
  readonly #logger: Logger;

  constructor(
    session: Pick<PurchasesSession, 'isConfigured'>,
    purchases: PurchasesGateway,
    logger: Logger,
  ) {
    this.#session = session;
    this.#purchases = purchases;
    this.#logger = logger;
  }

  getOfferings = async (): Promise<Result<SubscriptionOffering, SubscriptionError>> => {
    if (!this.#session.isConfigured()) {
      return err(SubscriptionErrors.storeUnavailable());
    }

    try {
      const offering = await this.#purchases.getOffering();
      if (offering == null) {
        return err(SubscriptionErrors.offeringsUnavailable());
      }
      return ok(toSubscriptionOffering(offering));
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.OFFERINGS_FETCH_FAILED, {
        error: getErrorMessage(error),
      });
      return err(toSubscriptionError('offerings', error));
    }
  };

  purchase = async (identifier: string): Promise<Result<boolean, SubscriptionError>> => {
    if (!this.#session.isConfigured()) {
      return err(SubscriptionErrors.storeUnavailable());
    }

    try {
      const result = await this.#purchases.purchase(identifier);
      return match(result)
        .returnType<Result<boolean, SubscriptionError>>()
        .with({ type: 'purchased' }, ({ status }) =>
          ok(CustomerInfoPolicy.hasStoreEntitlement(toCustomerInfo(status))),
        )
        .with({ type: 'package-not-found' }, () => err(SubscriptionErrors.offeringsUnavailable()))
        .exhaustive();
    } catch (error) {
      return err(toSubscriptionError('purchase', error));
    }
  };

  /**
   * 그 스토어에서 결제한 활성 구독의 상품 id. 알 수 없으면 null이고 호출부는 구독 목록을 연다.
   * 조회에 실패해도 목록으로 열면 되므로 "없음"과 "실패"를 구분하지 않고 실패는 경고로만 남긴다.
   */
  getActiveStoreProductId = async (store: SubscriptionStore): Promise<string | null> => {
    if (!this.#session.isConfigured()) {
      return null;
    }

    try {
      const customerInfo = toCustomerInfo(await this.#purchases.getStatus());
      return CustomerInfoPolicy.findStoreProductId(customerInfo, store);
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.CUSTOMER_INFO_FETCH_FAILED, {
        error: getErrorMessage(error),
      });
      return null;
    }
  };

  restorePurchases = async (): Promise<Result<boolean, SubscriptionError>> => {
    if (!this.#session.isConfigured()) {
      return err(SubscriptionErrors.storeUnavailable());
    }

    try {
      const customerInfo = toCustomerInfo(await this.#purchases.restore());
      return ok(CustomerInfoPolicy.hasStoreEntitlement(customerInfo));
    } catch (error) {
      return err(toSubscriptionError('restore', error));
    }
  };

  subscribeCustomerInfo = (listener: (customerInfo: CustomerInfo) => void): (() => void) => {
    if (!this.#session.isConfigured()) {
      return noop;
    }
    return this.#purchases.subscribe((dto) => {
      // SDK 콜백으로 예외가 새지 않게 모르는 값은 경고로만 남기고 이번 갱신은 건너뛴다
      try {
        listener(toCustomerInfo(dto));
      } catch (error) {
        this.#logger.warn(SUBSCRIPTION_LOG_EVENT.CUSTOMER_INFO_FETCH_FAILED, {
          error: getErrorMessage(error),
        });
      }
    });
  };
}
