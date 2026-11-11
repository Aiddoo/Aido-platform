import type { Logger } from '@src/core/ports/logger';
import {
  type PurchaseStatus,
  type PurchaseFailureKind,
  type PurchasePackage,
  type PurchasePackageType,
  type PurchasePeriodUnit,
  type PurchasesConfigureResult,
  type PurchasesGateway,
  PurchasesGatewayError,
  type PurchaseStore,
} from '@src/core/ports/purchases-gateway';
import { getErrorMessage } from '@src/shared/errors';
import { LogBox } from 'react-native';
import Purchases, {
  type CustomerInfo,
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
  type PurchasesStoreProduct,
  type Store,
} from 'react-native-purchases';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

import { PURCHASES_LOG_EVENT } from './purchases-log-events';
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

const purchasePeriodUnitSchema = z.enum([
  'DAY',
  'WEEK',
  'MONTH',
  'YEAR',
] as const satisfies readonly PurchasePeriodUnit[]);

type PurchaseFreeTrial = PurchasePackage['product']['freeTrial'];

/** 단위를 모르면(UNKNOWN) 체험 기간을 안내할 수 없어 체험이 없는 것으로 본다 */
function toFreeTrial(periodUnit: string, periodNumberOfUnits: number): PurchaseFreeTrial {
  const parsedUnit = purchasePeriodUnitSchema.safeParse(periodUnit);
  if (!parsedUnit.success || periodNumberOfUnits <= 0) {
    return null;
  }
  return { periodUnit: parsedUnit.data, periodNumberOfUnits };
}

/** defaultOption은 Google Play에만 있고, SDK가 자격 있는 혜택을 기본 옵션으로 고르므로 무료 단계가 있으면 자격이 있다 */
function toPlayFreeTrial(product: PurchasesStoreProduct): PurchaseFreeTrial {
  const freePhase = product.defaultOption?.freePhase;
  if (freePhase == null) {
    return null;
  }
  return toFreeTrial(freePhase.billingPeriod.unit, freePhase.billingPeriod.value);
}

/** App Store 무료 체험은 가격 0인 소개 가격이다. 상품에 실려 있어도 자격은 따로 물어야 한다 */
function hasAppStoreFreeTrialOffer(product: PurchasesStoreProduct) {
  return product.defaultOption == null && product.introPrice?.price === 0;
}

/** SDK 안내대로 ELIGIBLE만 체험을 보이고, UNKNOWN·INELIGIBLE·확인 실패는 일반 가격만 보인다 */
async function findIntroEligibleProductIds(
  products: readonly PurchasesStoreProduct[],
  logger: Pick<Logger, 'warn'>,
): Promise<ReadonlySet<string>> {
  const productIds = products.filter(hasAppStoreFreeTrialOffer).map(({ identifier }) => identifier);
  if (productIds.length === 0) {
    return new Set();
  }
  try {
    const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
    return new Set(
      productIds.filter(
        (productId) =>
          eligibility[productId]?.status ===
          INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE,
      ),
    );
  } catch (error) {
    logger.warn(PURCHASES_LOG_EVENT.TRIAL_ELIGIBILITY_CHECK_FAILED, {
      error: getErrorMessage(error),
    });
    return new Set();
  }
}

function toAppStoreFreeTrial(
  product: PurchasesStoreProduct,
  introEligibleProductIds: ReadonlySet<string>,
): PurchaseFreeTrial {
  const { introPrice } = product;
  if (introPrice == null || !introEligibleProductIds.has(product.identifier)) {
    return null;
  }
  return toFreeTrial(introPrice.periodUnit, introPrice.periodNumberOfUnits);
}

function toPurchasePackage(
  rcPackage: PurchasesPackage,
  introEligibleProductIds: ReadonlySet<string>,
): PurchasePackage {
  const { product } = rcPackage;
  return {
    identifier: rcPackage.identifier,
    packageType: PURCHASE_PACKAGE_TYPE[rcPackage.packageType],
    product: {
      priceString: product.priceString,
      price: product.price,
      currencyCode: product.currencyCode,
      title: product.title,
      description: product.description ?? null,
      freeTrial: hasAppStoreFreeTrialOffer(product)
        ? toAppStoreFreeTrial(product, introEligibleProductIds)
        : toPlayFreeTrial(product),
    },
  };
}

interface RevenueCatPurchasesGatewayOptions {
  isLogEnabled: boolean;
  logger: Pick<Logger, 'warn'>;
}

export function createRevenueCatPurchasesGateway({
  isLogEnabled,
  logger,
}: RevenueCatPurchasesGatewayOptions): PurchasesGateway {
  // 다시 설정하면 SDK가 공유 인스턴스를 바꿔 붙여 둔 고객 정보 리스너를 잃는다
  let configureResult: PurchasesConfigureResult | null = null;

  return {
    configure: () => {
      if (configureResult != null) {
        return configureResult;
      }
      const apiKey = getRevenueCatApiKey();
      if (!apiKey) {
        configureResult = 'missing-api-key';
        return configureResult;
      }
      if (isLogEnabled) {
        // 개발 빌드의 테스트 스토어 키는 상품·권한 매핑 갱신이 실패해 SDK 오류 로그가 LogBox로 로그인 화면을 덮는다. 터미널에는 그대로 찍힌다
        LogBox.ignoreLogs(['[RevenueCat]']);
        Purchases.setLogLevel(LOG_LEVEL.WARN);
      }
      Purchases.configure({ apiKey });
      configureResult = 'configured';
      return configureResult;
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
        const introEligibleProductIds = await findIntroEligibleProductIds(
          current.availablePackages.map(({ product }) => product),
          logger,
        );
        return {
          identifier: current.identifier,
          packages: current.availablePackages.map((rcPackage) =>
            toPurchasePackage(rcPackage, introEligibleProductIds),
          ),
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
