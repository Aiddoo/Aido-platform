import { type PurchaseFailureKind, PurchasesGatewayError } from '@src/core/ports/purchases';
import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';

import {
  revenueCatPurchasesGateway,
  toPurchasesGatewayError,
} from './revenuecat-purchases.gateway';

const mockLogOut = jest.fn(async () => undefined);

jest.mock('react-native-purchases', () => ({
  ...jest.requireActual('react-native-purchases'),
  __esModule: true,
  default: {
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    isAnonymous: jest.fn(),
    logOut: () => mockLogOut(),
  },
}));

const purchases = jest.mocked(Purchases);

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
  ])('%s %s 실패로 넘긴다', (_case, error, expectedKind, expectedStoreCode) => {
    // When
    const failure = toPurchasesGatewayError(error);

    // Then
    expect(failure).toBeInstanceOf(PurchasesGatewayError);
    expect(failure.kind).toBe(expectedKind);
    expect(failure.storeErrorCode).toBe(expectedStoreCode);
  });
});

describe('revenueCatPurchasesGateway', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('판매 중인 요금제에 없는 패키지는 결제창을 열지 않는다', async () => {
    // Given
    purchases.getOfferings.mockResolvedValue({ all: {}, current: null });

    // When
    const result = await revenueCatPurchasesGateway.purchase('$rc_monthly');

    // Then
    expect(result).toEqual({ type: 'package-not-found' });
    expect(purchases.purchasePackage).not.toHaveBeenCalled();
  });

  test('익명 사용자면 SDK 로그아웃을 부르지 않는다', async () => {
    // Given
    purchases.isAnonymous.mockResolvedValue(true);

    // When
    await revenueCatPurchasesGateway.logOut();

    // Then
    expect(mockLogOut).not.toHaveBeenCalled();
  });

  test('로그인한 사용자면 SDK 로그아웃을 부른다', async () => {
    // Given
    purchases.isAnonymous.mockResolvedValue(false);

    // When
    await revenueCatPurchasesGateway.logOut();

    // Then
    expect(mockLogOut).toHaveBeenCalledTimes(1);
  });

  test('고객 정보 구독을 끝내면 SDK에 붙인 같은 리스너를 뗀다', () => {
    // Given
    const unsubscribe = revenueCatPurchasesGateway.subscribe(jest.fn());
    const [attached] = purchases.addCustomerInfoUpdateListener.mock.calls[0] ?? [];

    // When
    unsubscribe();

    // Then
    expect(purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(attached);
  });
});
