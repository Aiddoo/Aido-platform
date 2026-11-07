import {
  type PurchaseStatus,
  type PurchaseFailureKind,
  type PurchasePackage,
  type PurchasePackageType,
  type PurchasesGateway,
  PurchasesGatewayError,
  type PurchaseStore,
} from '@src/core/ports/purchases-gateway';
import { getErrorMessage } from '@src/shared/errors';
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
  type Store,
} from 'react-native-purchases';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

import { getRevenueCatApiKey } from './revenuecat-api-key';

const storeErrorCodeSchema = z.enum(PURCHASES_ERROR_CODE);

const NETWORK_CODES = [
  PURCHASES_ERROR_CODE.NETWORK_ERROR,
  PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR,
  PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR,
  PURCHASES_ERROR_CODE.API_ENDPOINT_BLOCKED,
] as const;

const STORE_SETUP_CODES = [
  PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
  PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR,
  PURCHASES_ERROR_CODE.UNSUPPORTED_ERROR,
] as const;

function toStoreErrorCode(error: unknown) {
  if (typeof error !== 'object' || error == null || !('code' in error)) {
    return null;
  }
  const parsed = storeErrorCodeSchema.safeParse(error.code);
  return parsed.success ? parsed.data : null;
}

export function toPurchasesGatewayError(error: unknown) {
  const storeErrorCode = toStoreErrorCode(error);
  const kind = match(storeErrorCode)
    .returnType<PurchaseFailureKind>()
    .with(P.union(...NETWORK_CODES), () => 'network')
    .with(PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR, () => 'cancelled')
    .with(PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR, () => 'payment-pending')
    .with(P.union(...STORE_SETUP_CODES), () => 'store-setup')
    .with(PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR, () => 'store-problem')
    .otherwise(() => 'other');

  return new PurchasesGatewayError(kind, storeErrorCode, getErrorMessage(error));
}

async function withGatewayError<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw toPurchasesGatewayError(error);
  }
}

// SDK가 결제처·패키지 종류를 더하면 이 표가 컴파일되지 않아 앱이 구분할지 정하게 한다
const PURCHASE_STORE = {
  APP_STORE: 'APP_STORE',
  PLAY_STORE: 'PLAY_STORE',
  PROMOTIONAL: 'PROMOTIONAL',
  MAC_APP_STORE: 'OTHER',
  STRIPE: 'OTHER',
  AMAZON: 'OTHER',
  RC_BILLING: 'OTHER',
  EXTERNAL: 'OTHER',
  PADDLE: 'OTHER',
  TEST_STORE: 'OTHER',
  GALAXY: 'OTHER',
  UNKNOWN_STORE: 'OTHER',
} as const satisfies Record<Store, PurchaseStore>;

const PURCHASE_PACKAGE_TYPE = {
  [PACKAGE_TYPE.MONTHLY]: 'MONTHLY',
  [PACKAGE_TYPE.ANNUAL]: 'ANNUAL',
  [PACKAGE_TYPE.UNKNOWN]: 'OTHER',
  [PACKAGE_TYPE.CUSTOM]: 'OTHER',
  [PACKAGE_TYPE.LIFETIME]: 'OTHER',
  [PACKAGE_TYPE.SIX_MONTH]: 'OTHER',
  [PACKAGE_TYPE.THREE_MONTH]: 'OTHER',
  [PACKAGE_TYPE.TWO_MONTH]: 'OTHER',
  [PACKAGE_TYPE.WEEKLY]: 'OTHER',
} as const satisfies Record<PACKAGE_TYPE, PurchasePackageType>;

function toPurchaseStatus(info: CustomerInfo): PurchaseStatus {
  return {
    activeEntitlements: Object.values(info.entitlements.active).map((entitlement) => ({
      store: PURCHASE_STORE[entitlement.store],
      productIdentifier: entitlement.productIdentifier,
    })),
  };
}

function toPurchasePackage(rcPackage: PurchasesPackage): PurchasePackage {
  return {
    identifier: rcPackage.identifier,
    packageType: PURCHASE_PACKAGE_TYPE[rcPackage.packageType],
    product: {
      priceString: rcPackage.product.priceString,
      price: rcPackage.product.price,
      currencyCode: rcPackage.product.currencyCode,
      title: rcPackage.product.title,
      description: rcPackage.product.description ?? null,
    },
  };
}

interface RevenueCatPurchasesGatewayOptions {
  isLogEnabled: boolean;
}

export function createRevenueCatPurchasesGateway({
  isLogEnabled,
}: RevenueCatPurchasesGatewayOptions): PurchasesGateway {
  return {
    configure: () => {
      const apiKey = getRevenueCatApiKey();
      if (!apiKey) {
        return 'missing-api-key';
      }
      if (isLogEnabled) {
        Purchases.setLogLevel(LOG_LEVEL.WARN);
      }
      Purchases.configure({ apiKey });
      return 'configured';
    },

    logIn: async (userId) => {
      await Purchases.logIn(userId);
    },

    // 익명 사용자에게 SDK logOut을 부르면 오류가 나므로 로그인한 사용자일 때만 부른다
    logOut: async () => {
      if (await Purchases.isAnonymous()) {
        return;
      }
      await Purchases.logOut();
    },

    setAttributes: (attributes) => Purchases.setAttributes(attributes),

    setAnalyticsId: (analyticsId) => Purchases.setFirebaseAppInstanceID(analyticsId),

    getOffering: () =>
      withGatewayError(async () => {
        const { current } = await Purchases.getOfferings();
        if (current == null) {
          return null;
        }
        return {
          identifier: current.identifier,
          packages: current.availablePackages.map(toPurchasePackage),
        };
      }),

    // SDK가 요금제를 메모리에 캐시하므로 구매 때 다시 받아도 스토어에 다시 묻지 않는다
    purchase: (packageIdentifier) =>
      withGatewayError(async () => {
        const { current } = await Purchases.getOfferings();
        const rcPackage = current?.availablePackages.find(
          (candidate) => candidate.identifier === packageIdentifier,
        );
        if (rcPackage == null) {
          return { type: 'package-not-found' } as const;
        }
        const { customerInfo } = await Purchases.purchasePackage(rcPackage);
        return { type: 'purchased', status: toPurchaseStatus(customerInfo) } as const;
      }),

    restore: () =>
      withGatewayError(async () => toPurchaseStatus(await Purchases.restorePurchases())),

    getStatus: () =>
      withGatewayError(async () => toPurchaseStatus(await Purchases.getCustomerInfo())),

    subscribe: (listener) => {
      const handleUpdate = (info: CustomerInfo) => listener(toPurchaseStatus(info));
      Purchases.addCustomerInfoUpdateListener(handleUpdate);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(handleUpdate);
      };
    },
  };
}
