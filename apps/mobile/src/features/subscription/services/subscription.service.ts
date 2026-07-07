import type { Logger } from '@src/core/ports/logger';
import { err, ok, type Result } from '@src/shared/errors/result';
import { t } from '@src/shared/i18n';
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
  readonly #logger: Logger;
  #packageMap = new Map<string, PurchasesPackage>();

  constructor(sdkManager: RevenueCatSdkManager, logger: Logger) {
    this.#sdkManager = sdkManager;
    this.#logger = logger;
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
      this.#logger.warn('[SubscriptionService] GetOfferings failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      const message = error instanceof Error ? error.message : undefined;
      return err(SubscriptionErrors.fetchOfferingsFailed(message));
    }
  };

  purchase = async (identifier: string): Promise<Result<boolean, SubscriptionError>> => {
    if (!this.#sdkManager.isConfigured()) {
      return err(SubscriptionErrors.notConfigured());
    }

    let rcPackage = this.#packageMap.get(identifier);
    if (!rcPackage) {
      const refetchResult = await this.getOfferings();
      if (!refetchResult.ok) {
        return err(
          SubscriptionErrors.purchaseFailed(t('subscription:errors.offeringsInfoUnavailable')),
        );
      }
      rcPackage = this.#packageMap.get(identifier);
      if (!rcPackage) {
        return err(
          SubscriptionErrors.purchaseFailed(t('subscription:errors.offeringsInfoNotFound')),
        );
      }
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(rcPackage);
      const hasActive = Object.keys(customerInfo.entitlements.active).length > 0;
      return ok(hasActive);
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
      const message =
        error instanceof Error ? error.message : t('subscription:errors.restoreFailed');
      return err(SubscriptionErrors.restoreFailed(message));
    }
  };
}
