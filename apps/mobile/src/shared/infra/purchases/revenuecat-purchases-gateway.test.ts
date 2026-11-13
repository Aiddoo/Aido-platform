import { type PurchaseFailureKind, PurchasesGatewayError } from '@src/core/ports/purchases-gateway';
import { createAppLoggerStub } from '@src/testing/ports/app-logger.stub';
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  PACKAGE_TYPE,
  PERIOD_UNIT,
  PRODUCT_TYPE,
  PURCHASES_ERROR_CODE,
  type PricingPhase,
  type PurchasesPackage,
  type PurchasesStoreProduct,
  type SubscriptionOption,
} from 'react-native-purchases';

import {
  createRevenueCatPurchasesGateway,
  toPurchasesGatewayError,
} from './revenuecat-purchases-gateway';

const mockLogOut = jest.fn(async () => undefined);
const mockExtra: { revenueCatAppleApiKey?: string } = {};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: { isDevelopment: false, ...mockExtra } };
    },
  },
}));

jest.mock('react-native-purchases', () => ({
  ...jest.requireActual('react-native-purchases'),
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getOfferings: jest.fn(),
    checkTrialOrIntroductoryPriceEligibility: jest.fn(),
    purchasePackage: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    isAnonymous: jest.fn(),
    logOut: () => mockLogOut(),
  },
}));

const purchases = jest.mocked(Purchases);

const ANNUAL_PRODUCT_ID = 'com.aido.pro.yearly';

function createStoreProduct(overrides: Partial<PurchasesStoreProduct> = {}): PurchasesStoreProduct {
  return {
    identifier: ANNUAL_PRODUCT_ID,
    description: '',
    title: 'Aido Pro',
    price: 29_900,
    priceString: '₩29,900',
    pricePerWeek: null,
    pricePerMonth: null,
    pricePerYear: null,
    pricePerWeekString: null,
    pricePerMonthString: null,
    pricePerYearString: null,
    currencyCode: 'KRW',
    introPrice: null,
    discounts: null,
    productCategory: null,
    productType: PRODUCT_TYPE.AUTO_RENEWABLE_SUBSCRIPTION,
    subscriptionPeriod: 'P1Y',
    defaultOption: null,
    subscriptionOptions: null,
    presentedOfferingIdentifier: null,
    presentedOfferingContext: null,
    installmentsInfo: null,
    ...overrides,
  };
}

/** App Store 무료 체험은 가격 0인 소개 가격으로 실린다 */
const APP_STORE_FREE_TWO_WEEKS = {
  price: 0,
  priceString: '₩0',
  cycles: 1,
  period: 'P2W',
  periodUnit: 'WEEK',
  periodNumberOfUnits: 2,
};

function createPricingPhase(
  amountMicros: number,
  iso8601: string,
  unit: PERIOD_UNIT,
  value = 1,
): PricingPhase {
  return {
    billingPeriod: { unit, value, iso8601 },
    recurrenceMode: null,
    billingCycleCount: null,
    price: { formatted: amountMicros === 0 ? '₩0' : '₩29,900', amountMicros, currencyCode: 'KRW' },
    offerPaymentMode: null,
  };
}

function createPlayOption(freePhase: PricingPhase | null): SubscriptionOption {
  const fullPricePhase = createPricingPhase(29_900_000_000, 'P1Y', PERIOD_UNIT.YEAR);
  return {
    id: freePhase == null ? 'yearly-base' : 'yearly-base:annual-trial-2w',
    storeProductId: `${ANNUAL_PRODUCT_ID}:yearly-base`,
    productId: ANNUAL_PRODUCT_ID,
    pricingPhases: freePhase == null ? [fullPricePhase] : [freePhase, fullPricePhase],
    tags: [],
    isBasePlan: freePhase == null,
    billingPeriod: fullPricePhase.billingPeriod,
    isPrepaid: false,
    fullPricePhase,
    freePhase,
    introPhase: null,
    presentedOfferingIdentifier: null,
    presentedOfferingContext: null,
    installmentsInfo: null,
  };
}

function givenOffering(product: PurchasesStoreProduct) {
  const annualPackage: PurchasesPackage = {
    identifier: '$rc_annual',
    packageType: PACKAGE_TYPE.ANNUAL,
    product,
    offeringIdentifier: 'default',
    presentedOfferingContext: {
      offeringIdentifier: 'default',
      placementIdentifier: null,
      targetingContext: null,
    },
    webCheckoutUrl: null,
  };
  purchases.getOfferings.mockResolvedValue({
    all: {},
    current: {
      identifier: 'default',
      serverDescription: '',
      metadata: {},
      availablePackages: [annualPackage],
      lifetime: null,
      annual: annualPackage,
      sixMonth: null,
      threeMonth: null,
      twoMonth: null,
      monthly: null,
      weekly: null,
      webCheckoutUrl: null,
    },
  });
}

function givenIntroEligibility(status: INTRO_ELIGIBILITY_STATUS) {
  purchases.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({
    [ANNUAL_PRODUCT_ID]: { status, description: '' },
  });
}

/** RevenueCat SDK가 던지는 오류 모양(PurchasesError)만 흉내 낸다 */
const sdkError = (code: PURCHASES_ERROR_CODE) => ({ code, message: 'sdk message' });

describe('toPurchasesGatewayError', () => {
  it.each<[string, unknown, PurchaseFailureKind, string | null]>([
    ['연결이 끊기면', sdkError(PURCHASES_ERROR_CODE.NETWORK_ERROR), 'network', '10'],
    ['오프라인이면', sdkError(PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR), 'network', '35'],
    [
      '상품 요청이 시간 초과되면',
      sdkError(PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR),
      'network',
      '32',
    ],
    [
      '스토어 설정이 잘못됐으면',
      sdkError(PURCHASES_ERROR_CODE.CONFIGURATION_ERROR),
      'store-setup',
      '23',
    ],
    [
      'API 키가 잘못됐으면',
      sdkError(PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR),
      'store-setup',
      '11',
    ],
    [
      '스토어 자체에 문제가 있으면',
      sdkError(PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR),
      'store-problem',
      '2',
    ],
    [
      '사용자가 결제를 취소하면',
      sdkError(PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR),
      'cancelled',
      '1',
    ],
    [
      '결제 승인을 기다리면(Ask to Buy)',
      sdkError(PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR),
      'payment-pending',
      '20',
    ],
    [
      '영수증이 다른 계정에 있으면',
      sdkError(PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR),
      'other',
      '7',
    ],
    ['SDK 오류가 아닌 값이면', new Error('boom'), 'other', null],
    ['SDK 코드가 아닌 code 값이면', { code: 'not-a-store-code' }, 'other', null],
  ])(
    '%s 기대한 실패 종류와 스토어 코드로 바꾼다',
    (_case, error, expectedKind, expectedStoreCode) => {
      // When
      const failure = toPurchasesGatewayError(error);

      // Then
      expect(failure).toBeInstanceOf(PurchasesGatewayError);
      expect(failure.kind).toBe(expectedKind);
      expect(failure.storeErrorCode).toBe(expectedStoreCode);
    },
  );
});

describe('createRevenueCatPurchasesGateway', () => {
  const logger = createAppLoggerStub();
  const revenueCatPurchasesGateway = createRevenueCatPurchasesGateway({
    isLogEnabled: false,
    logger,
  });

  afterEach(() => {
    delete mockExtra.revenueCatAppleApiKey;
    jest.resetAllMocks();
  });

  it('판매 중인 요금제에 없는 패키지는 결제창을 열지 않는다', async () => {
    // Given
    purchases.getOfferings.mockResolvedValue({ all: {}, current: null });

    // When
    const result = await revenueCatPurchasesGateway.purchase('$rc_monthly');

    // Then
    expect(result).toEqual({ type: 'package-not-found' });
    expect(purchases.purchasePackage).not.toHaveBeenCalled();
  });

  describe('무료 체험', () => {
    const TWO_WEEKS = { periodUnit: 'WEEK', periodNumberOfUnits: 2 };

    async function getAnnualFreeTrial() {
      const offering = await revenueCatPurchasesGateway.getOffering();
      return offering?.packages[0]?.product.freeTrial;
    }

    it('App Store 무료 체험에 자격이 있으면 체험 기간을 싣는다', async () => {
      // Given
      givenOffering(createStoreProduct({ introPrice: APP_STORE_FREE_TWO_WEEKS }));
      givenIntroEligibility(INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE);

      // When
      const freeTrial = await getAnnualFreeTrial();

      // Then
      expect(freeTrial).toEqual(TWO_WEEKS);
      expect(purchases.checkTrialOrIntroductoryPriceEligibility).toHaveBeenCalledWith([
        ANNUAL_PRODUCT_ID,
      ]);
    });

    it.each([
      ['이미 체험했으면', INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE],
      ['스토어가 자격을 모르면', INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_UNKNOWN],
    ])(
      'App Store 무료 체험이 있어도 %s 일반 가격만 보이게 체험을 싣지 않는다',
      async (_case, status) => {
        // Given
        givenOffering(createStoreProduct({ introPrice: APP_STORE_FREE_TWO_WEEKS }));
        givenIntroEligibility(status);

        // When
        const freeTrial = await getAnnualFreeTrial();

        // Then
        expect(freeTrial).toBeNull();
      },
    );

    it('자격 확인이 실패해도 요금제는 받고 체험만 싣지 않으며 실패를 남긴다', async () => {
      // Given
      givenOffering(createStoreProduct({ introPrice: APP_STORE_FREE_TWO_WEEKS }));
      purchases.checkTrialOrIntroductoryPriceEligibility.mockRejectedValue(new Error('boom'));

      // When
      const offering = await revenueCatPurchasesGateway.getOffering();

      // Then
      expect(offering?.packages[0]?.product).toMatchObject({ price: 29_900, freeTrial: null });
      expect(logger.warn).toHaveBeenCalledWith('subscription.trial-eligibility.check-failed', {
        error: 'boom',
      });
    });

    it('유료 소개 가격은 무료 체험이 아니라 자격을 묻지 않는다', async () => {
      // Given
      givenOffering(
        createStoreProduct({
          introPrice: { ...APP_STORE_FREE_TWO_WEEKS, price: 9_900, priceString: '₩9,900' },
        }),
      );

      // When
      const freeTrial = await getAnnualFreeTrial();

      // Then
      expect(freeTrial).toBeNull();
      expect(purchases.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
    });

    it('Google Play 기본 옵션에 무료 단계가 있으면 자격이 있어 체험 기간을 싣는다', async () => {
      // Given
      const option = createPlayOption(createPricingPhase(0, 'P2W', PERIOD_UNIT.WEEK, 2));
      givenOffering(
        createStoreProduct({
          defaultOption: option,
          subscriptionOptions: [option],
          introPrice: APP_STORE_FREE_TWO_WEEKS,
        }),
      );

      // When
      const freeTrial = await getAnnualFreeTrial();

      // Then
      expect(freeTrial).toEqual(TWO_WEEKS);
      expect(purchases.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
    });

    it.each([
      ['기본 옵션에 무료 단계가 없으면', createPlayOption(null)],
      [
        '무료 단계의 기간 단위를 모르면',
        createPlayOption(createPricingPhase(0, 'P2W', PERIOD_UNIT.UNKNOWN, 2)),
      ],
    ])('Google Play %s 체험을 싣지 않는다', async (_case, option) => {
      // Given
      givenOffering(createStoreProduct({ defaultOption: option, subscriptionOptions: [option] }));

      // When
      const freeTrial = await getAnnualFreeTrial();

      // Then
      expect(freeTrial).toBeNull();
    });
  });

  it('익명 사용자면 SDK 로그아웃을 부르지 않는다', async () => {
    // Given
    purchases.isAnonymous.mockResolvedValue(true);

    // When
    await revenueCatPurchasesGateway.logOut();

    // Then
    expect(mockLogOut).not.toHaveBeenCalled();
  });

  it('로그인한 사용자면 SDK 로그아웃을 부른다', async () => {
    // Given
    purchases.isAnonymous.mockResolvedValue(false);

    // When
    await revenueCatPurchasesGateway.logOut();

    // Then
    expect(mockLogOut).toHaveBeenCalledTimes(1);
  });

  it('고객 정보 구독을 끝내면 SDK에 붙인 같은 리스너를 뗀다', () => {
    // Given
    const unsubscribe = revenueCatPurchasesGateway.subscribe(jest.fn());
    const [attached] = purchases.addCustomerInfoUpdateListener.mock.calls[0] ?? [];

    // When
    unsubscribe();

    // Then
    expect(purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(attached);
  });

  it('이 빌드에 결제 키가 있으면 SDK를 초기화한다', () => {
    // Given
    mockExtra.revenueCatAppleApiKey = 'appl_fixture';
    const gateway = createRevenueCatPurchasesGateway({ isLogEnabled: false, logger });

    // When
    const result = gateway.configure();

    // Then
    expect(result).toBe('configured');
    expect(purchases.configure).toHaveBeenCalledWith({ apiKey: 'appl_fixture' });
  });

  it('결제 키가 없는 빌드는 SDK를 초기화하지 않는다', () => {
    // Given
    const gateway = createRevenueCatPurchasesGateway({ isLogEnabled: false, logger });

    // When
    const result = gateway.configure();

    // Then
    expect(result).toBe('missing-api-key');
    expect(purchases.configure).not.toHaveBeenCalled();
  });

  it('다시 불러도 SDK는 한 번만 초기화하고 처음 결과를 돌려준다', () => {
    // Given
    mockExtra.revenueCatAppleApiKey = 'appl_fixture';
    const gateway = createRevenueCatPurchasesGateway({ isLogEnabled: false, logger });
    gateway.configure();

    // When
    const result = gateway.configure();

    // Then
    expect(result).toBe('configured');
    expect(purchases.configure).toHaveBeenCalledTimes(1);
  });

  it('초기화가 실패하면 다음 호출이 다시 초기화한다', () => {
    // Given
    mockExtra.revenueCatAppleApiKey = 'appl_fixture';
    const gateway = createRevenueCatPurchasesGateway({ isLogEnabled: false, logger });
    purchases.configure.mockImplementationOnce(() => {
      throw new Error('native module not ready');
    });
    expect(() => gateway.configure()).toThrow('native module not ready');

    // When
    const result = gateway.configure();

    // Then
    expect(result).toBe('configured');
    expect(purchases.configure).toHaveBeenCalledTimes(2);
  });
});
