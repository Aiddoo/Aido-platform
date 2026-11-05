import type { Logger } from '@src/core/ports/logger';
import type { PurchasesGateway } from '@src/core/ports/purchases';
import { getErrorMessage } from '@src/shared/errors';
import { err, ok, type Result } from '@src/shared/errors/result';
import { noop } from 'es-toolkit';
import { match } from 'ts-pattern';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import {
  type CustomerInfo,
  CustomerInfoPolicy,
  type SubscriptionStore,
} from '../domains/customer-info.model';
import { type SubscriptionError, SubscriptionErrors } from '../domains/subscription.error';
import type { SubscriptionOffering } from '../domains/subscription.model';
import type { RevenueCatSdkManager } from './revenuecat-sdk-manager';
import { toSubscriptionError } from './subscription-error.mapper';
import { toCustomerInfo, toSubscriptionOffering } from './subscription.mapper';

/**
 * 구독 비즈니스 로직 (offerings 조회, 구매, 복원)
 *
 * SDK 라이프사이클(configure/logIn/logOut)은 RevenueCatSdkManager가 담당.
 */
export class SubscriptionService {
  readonly #sdkManager: RevenueCatSdkManager;
  readonly #purchases: PurchasesGateway;
  readonly #logger: Logger;

  constructor(sdkManager: RevenueCatSdkManager, purchases: PurchasesGateway, logger: Logger) {
    this.#sdkManager = sdkManager;
    this.#purchases = purchases;
    this.#logger = logger;
  }

  getOfferings = async (): Promise<Result<SubscriptionOffering, SubscriptionError>> => {
    if (!this.#sdkManager.isConfigured()) {
      return err(SubscriptionErrors.storeUnavailable());
    }

    try {
      const offering = await this.#purchases.getCurrentOffering();
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
    if (!this.#sdkManager.isConfigured()) {
      return err(SubscriptionErrors.storeUnavailable());
    }

    try {
      const result = await this.#purchases.purchasePackage(identifier);
      return match(result)
        .returnType<Result<boolean, SubscriptionError>>()
        .with({ type: 'purchased' }, ({ customerInfo }) =>
          ok(CustomerInfoPolicy.hasStoreEntitlement(toCustomerInfo(customerInfo))),
        )
        .with({ type: 'package-not-found' }, () => err(SubscriptionErrors.offeringsUnavailable()))
        .exhaustive();
    } catch (error) {
      return err(toSubscriptionError('purchase', error));
    }
  };

  /** 그 스토어에서 결제한 활성 구독의 상품 id. 알 수 없으면 null이고 호출부는 구독 목록을 연다. */
  getActiveStoreProductId = async (store: SubscriptionStore): Promise<string | null> => {
    if (!this.#sdkManager.isConfigured()) {
      return null;
    }

    try {
      const customerInfo = toCustomerInfo(await this.#purchases.getCustomerInfo());
      return CustomerInfoPolicy.findStoreProductId(customerInfo, store);
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.CUSTOMER_INFO_FETCH_FAILED, {
        error: getErrorMessage(error),
      });
      return null;
    }
  };

  restorePurchases = async (): Promise<Result<boolean, SubscriptionError>> => {
    if (!this.#sdkManager.isConfigured()) {
      return err(SubscriptionErrors.storeUnavailable());
    }

    try {
      const customerInfo = toCustomerInfo(await this.#purchases.restorePurchases());
      return ok(CustomerInfoPolicy.hasStoreEntitlement(customerInfo));
    } catch (error) {
      return err(toSubscriptionError('restore', error));
    }
  };

  /** 스토어 구독이 바뀌면 알린다. 초기화 전이면 알릴 것이 없다. 반환 함수로 구독을 끝낸다 */
  subscribeCustomerInfo = (listener: (customerInfo: CustomerInfo) => void): (() => void) => {
    if (!this.#sdkManager.isConfigured()) {
      return noop;
    }
    return this.#purchases.onCustomerInfoChange((dto) => listener(toCustomerInfo(dto)));
  };
}
