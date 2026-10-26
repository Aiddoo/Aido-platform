import { PURCHASES_ERROR_CODE } from 'react-native-purchases';

import { SubscriptionErrorCode } from '../domains/subscription.error';
import { type StoreOperation, toSubscriptionError } from './revenuecat-error.mapper';

/** RevenueCat SDK가 던지는 오류 모양(PurchasesError)만 흉내 낸다 */
const storeError = (code: PURCHASES_ERROR_CODE) => ({ code, message: 'sdk message' });

describe('toSubscriptionError', () => {
  it.each<[string, StoreOperation, unknown, string, string | null]>([
    [
      '요금제 조회 중 연결이 끊기면',
      'offerings',
      storeError(PURCHASES_ERROR_CODE.NETWORK_ERROR),
      SubscriptionErrorCode.NETWORK,
      '10',
    ],
    [
      '요금제 조회 중 오프라인이면',
      'offerings',
      storeError(PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR),
      SubscriptionErrorCode.NETWORK,
      '35',
    ],
    [
      '스토어 상품 요청이 시간 초과되면',
      'offerings',
      storeError(PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR),
      SubscriptionErrorCode.NETWORK,
      '32',
    ],
    [
      '스토어 설정이 잘못됐으면(에뮬레이터 Error fetching offerings)',
      'offerings',
      storeError(PURCHASES_ERROR_CODE.CONFIGURATION_ERROR),
      SubscriptionErrorCode.STORE_UNAVAILABLE,
      '23',
    ],
    [
      '스토어 자체에 문제가 있으면',
      'offerings',
      storeError(PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR),
      SubscriptionErrorCode.STORE_UNAVAILABLE,
      '2',
    ],
    [
      '요금제 조회가 알 수 없는 백엔드 오류로 실패하면',
      'offerings',
      storeError(PURCHASES_ERROR_CODE.UNKNOWN_BACKEND_ERROR),
      SubscriptionErrorCode.OFFERINGS_UNAVAILABLE,
      '16',
    ],
    [
      '요금제 조회가 SDK 오류가 아닌 값으로 실패하면',
      'offerings',
      new Error('boom'),
      SubscriptionErrorCode.OFFERINGS_UNAVAILABLE,
      null,
    ],
    [
      '사용자가 결제를 취소하면',
      'purchase',
      storeError(PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR),
      SubscriptionErrorCode.PURCHASE_CANCELLED,
      '1',
    ],
    [
      '결제 승인을 기다리면(Ask to Buy)',
      'purchase',
      storeError(PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR),
      SubscriptionErrorCode.PAYMENT_PENDING,
      '20',
    ],
    [
      '결제 중 연결이 끊기면',
      'purchase',
      storeError(PURCHASES_ERROR_CODE.NETWORK_ERROR),
      SubscriptionErrorCode.NETWORK,
      '10',
    ],
    [
      '결제가 스토어 문제로 실패하면',
      'purchase',
      storeError(PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR),
      SubscriptionErrorCode.PURCHASE_FAILED,
      '2',
    ],
    [
      '결제가 SDK 오류가 아닌 값으로 실패하면',
      'purchase',
      'unexpected',
      SubscriptionErrorCode.PURCHASE_FAILED,
      null,
    ],
    [
      '복원 중 오프라인이면',
      'restore',
      storeError(PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR),
      SubscriptionErrorCode.NETWORK,
      '35',
    ],
    [
      '복원 영수증이 다른 계정에 있으면',
      'restore',
      storeError(PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR),
      SubscriptionErrorCode.RESTORE_FAILED,
      '7',
    ],
    [
      '복원에서 취소 코드가 와도 복원 실패로 본다',
      'restore',
      storeError(PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR),
      SubscriptionErrorCode.RESTORE_FAILED,
      '1',
    ],
  ])(
    '%s → %s 작업은 %s 오류가 된다',
    (_case, operation, error, expectedCode, expectedStoreCode) => {
      // When
      const result = toSubscriptionError(operation, error);

      // Then
      expect(result.code).toBe(expectedCode);
      expect(result.storeErrorCode).toBe(expectedStoreCode);
    },
  );

  it('SDK 코드가 아닌 code 값은 진단 코드로 남기지 않는다', () => {
    // When
    const result = toSubscriptionError('restore', { code: 'not-a-store-code' });

    // Then
    expect(result.storeErrorCode).toBeNull();
  });
});
