import { err, ok, type Result } from '@src/core/errors/result';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { PurchasesGateway } from '@src/core/ports/purchases-gateway';
import { getErrorMessage } from '@src/shared/errors';
import { noop } from 'es-toolkit';
import { match } from 'ts-pattern';

import { toCustomerInfo } from '../apis/customer-info.mapper';
import { toSubscriptionError } from '../apis/subscription-error.mapper';
import { toSubscriptionOffering } from '../apis/subscription.mapper';
import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import { type CustomerInfo, type SubscriptionStore } from '../domains/customer-info.model';
import { CustomerInfoPolicy } from '../domains/customer-info.model';
import { type SubscriptionError, SubscriptionErrors } from '../domains/subscription.error';
import { type SubscriptionOffering } from '../domains/subscription.model';
import type { PurchasesSession } from './purchases.session';

interface ManagementSource {
  /** 스토어가 알려 준 구독 관리 주소. 스토어 구독이 없거나 서버가 준 프리미엄이면 null이다 */
  managementUrl: string | null;
  productId: string | null;
}

const NO_MANAGEMENT_SOURCE: ManagementSource = { managementUrl: null, productId: null };

export class SubscriptionService {
  readonly #session: Pick<PurchasesSession, 'isConfigured'>;
  readonly #purchases: PurchasesGateway;
  readonly #logger: AppLogger;

  constructor(
    session: Pick<PurchasesSession, 'isConfigured'>,
    purchases: PurchasesGateway,
    logger: AppLogger,
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

  // 조회 실패도 "없음"과 구분하지 않고 경고만 남긴다. 호출부는 모두 null이면 구독 목록을 연다
  findManagementSource = async (store: SubscriptionStore): Promise<ManagementSource> => {
    if (!this.#session.isConfigured()) {
      return NO_MANAGEMENT_SOURCE;
    }

    try {
      const customerInfo = toCustomerInfo(await this.#purchases.getStatus());
      return {
        managementUrl: customerInfo.managementUrl,
        productId: CustomerInfoPolicy.findStoreProductId(customerInfo, store),
      };
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.CUSTOMER_INFO_FETCH_FAILED, {
        error: getErrorMessage(error),
      });
      return NO_MANAGEMENT_SOURCE;
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
