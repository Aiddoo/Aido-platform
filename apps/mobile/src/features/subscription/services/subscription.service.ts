import { err, ok, type Result } from '@src/shared/errors/result';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import { type SubscriptionError, SubscriptionErrors } from '../models/subscription.error';
import type { SubscriptionOffering } from '../models/subscription.model';
import type { RevenueCatSdkManager } from './revenuecat-sdk-manager';
import { toSubscriptionOfferingWithPackages } from './subscription.mapper';

/**
 * 구독 비즈니스 로직 (offerings 조회, 구매, 복원)
 *
 * SDK 라이프사이클(configure/logIn/logOut)은 RevenueCatSdkManager가 담당.
 */
export class SubscriptionService {
  readonly #sdkManager: RevenueCatSdkManager;
  #packageMap = new Map<string, PurchasesPackage>();

  constructor(sdkManager: RevenueCatSdkManager) {
    this.#sdkManager = sdkManager;
  }

  getOfferings = async (): Promise<Result<SubscriptionOffering, SubscriptionError>> => {
    if (!this.#sdkManager.isConfigured()) {
      return err(SubscriptionErrors.notConfigured());
    }

    try {
      const offerings = await Purchases.getOfferings();
      const result = toSubscriptionOfferingWithPackages(offerings);

      if (!result) {
        return err(SubscriptionErrors.noOfferings());
      }

      this.#packageMap = result.packageMap;
      return ok(result.offering);
    } catch (error) {
      if (__DEV__) console.warn('[SubscriptionService] getOfferings failed:', error);
      const message = error instanceof Error ? error.message : undefined;
      return err(SubscriptionErrors.fetchOfferingsFailed(message));
    }
  };

  purchase = async (identifier: string): Promise<Result<void, SubscriptionError>> => {
    if (!this.#sdkManager.isConfigured()) {
      return err(SubscriptionErrors.notConfigured());
    }

    const rcPackage = this.#packageMap.get(identifier);
    if (!rcPackage) {
      return err(SubscriptionErrors.purchaseFailed('구독 상품 정보를 찾을 수 없어요'));
    }

    try {
      await Purchases.purchasePackage(rcPackage);
      return ok(undefined);
    } catch (error) {
      return err(SubscriptionErrors.fromPurchaseError(error));
    }
  };

  restorePurchases = async (): Promise<Result<boolean, SubscriptionError>> => {
    if (!this.#sdkManager.isConfigured()) {
      return err(SubscriptionErrors.notConfigured());
    }

    try {
      const customerInfo = await Purchases.restorePurchases();
      const hasActive = Object.keys(customerInfo.entitlements.active).length > 0;
      return ok(hasActive);
    } catch (error) {
      const message = error instanceof Error ? error.message : '구매 복원에 실패했어요';
      return err(SubscriptionErrors.restoreFailed(message));
    }
  };
}
