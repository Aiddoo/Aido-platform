import type { Logger } from '@src/core/ports/logger';
import { err, ok, type Result } from '@src/shared/errors/result';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import { type SubscriptionError, SubscriptionErrors } from '../domains/subscription.error';
import type { SubscriptionOffering } from '../domains/subscription.model';
import { CustomerInfoPolicy } from './customer-info.policy';
import { toSubscriptionError } from './revenuecat-error.mapper';
import type { RevenueCatSdkManager } from './revenuecat-sdk-manager';
import { toSubscriptionOfferingWithPackages } from './subscription.mapper';

/**
 * 구독 비즈니스 로직 (offerings 조회, 구매, 복원)
 *
 * SDK 라이프사이클(configure/logIn/logOut)은 RevenueCatSdkManager가 담당.
 */
export class SubscriptionService {
  readonly #sdkManager: RevenueCatSdkManager;
  readonly #logger: Logger;
  #packageMap = new Map<string, PurchasesPackage>();

  constructor(sdkManager: RevenueCatSdkManager, logger: Logger) {
    this.#sdkManager = sdkManager;
    this.#logger = logger;
  }

  getOfferings = async (): Promise<Result<SubscriptionOffering, SubscriptionError>> => {
    if (!this.#sdkManager.isConfigured()) {
      return err(SubscriptionErrors.storeUnavailable());
    }

    try {
      const offerings = await Purchases.getOfferings();
      const result = toSubscriptionOfferingWithPackages(offerings);

      if (!result) {
        return err(SubscriptionErrors.offeringsUnavailable());
      }

      this.#packageMap = result.packageMap;
      return ok(result.offering);
    } catch (error) {
      this.#logger.warn(SUBSCRIPTION_LOG_EVENT.OFFERINGS_FETCH_FAILED, {
        error: error instanceof Error ? error.message : String(error),
      });
      return err(toSubscriptionError('offerings', error));
    }
  };

  purchase = async (identifier: string): Promise<Result<boolean, SubscriptionError>> => {
    if (!this.#sdkManager.isConfigured()) {
      return err(SubscriptionErrors.storeUnavailable());
    }

    let rcPackage = this.#packageMap.get(identifier);
    if (!rcPackage) {
      const refetchResult = await this.getOfferings();
      if (!refetchResult.ok) {
        return refetchResult;
      }
      rcPackage = this.#packageMap.get(identifier);
      if (!rcPackage) {
        return err(SubscriptionErrors.offeringsUnavailable());
      }
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(rcPackage);
      return ok(CustomerInfoPolicy.hasStoreEntitlement(customerInfo.entitlements));
    } catch (error) {
      return err(toSubscriptionError('purchase', error));
    }
  };

  restorePurchases = async (): Promise<Result<boolean, SubscriptionError>> => {
    if (!this.#sdkManager.isConfigured()) {
      return err(SubscriptionErrors.storeUnavailable());
    }

    try {
      const customerInfo = await Purchases.restorePurchases();
      return ok(CustomerInfoPolicy.hasStoreEntitlement(customerInfo.entitlements));
    } catch (error) {
      return err(toSubscriptionError('restore', error));
    }
  };
}
