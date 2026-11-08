import { type PurchaseFailureKind, PurchasesGatewayError } from '@src/core/ports/purchases-gateway';

import { SUBSCRIPTION_ERROR_CODE } from '../domains/subscription.error';
import { type StoreOperation, toSubscriptionError } from './subscription-error.mapper';

const storeFailure = (kind: PurchaseFailureKind, storeErrorCode: string) =>
  new PurchasesGatewayError(kind, storeErrorCode, 'sdk message');

describe('toSubscriptionError', () => {
  it.each<[string, StoreOperation, unknown, string, string | null]>([
    [
      '요금제 조회 중 연결이 끊기면',
      'offerings',
      storeFailure('network', '10'),
      SUBSCRIPTION_ERROR_CODE.NETWORK,
      '10',
    ],
    [
      '스토어 설정이 잘못됐으면(에뮬레이터 Error fetching offerings)',
      'offerings',
      storeFailure('store-setup', '23'),
      SUBSCRIPTION_ERROR_CODE.STORE_UNAVAILABLE,
      '23',
    ],
    [
      '스토어 자체에 문제가 있으면',
      'offerings',
      storeFailure('store-problem', '2'),
      SUBSCRIPTION_ERROR_CODE.STORE_PROBLEM,
      '2',
    ],
    [
      '요금제 조회가 알 수 없는 백엔드 오류로 실패하면',
      'offerings',
      storeFailure('other', '16'),
      SUBSCRIPTION_ERROR_CODE.OFFERINGS_UNAVAILABLE,
      '16',
    ],
    [
      '요금제 조회가 스토어 오류가 아닌 값으로 실패하면',
      'offerings',
      new Error('boom'),
      SUBSCRIPTION_ERROR_CODE.OFFERINGS_UNAVAILABLE,
      null,
    ],
    [
      '사용자가 결제를 취소하면',
      'purchase',
      storeFailure('cancelled', '1'),
      SUBSCRIPTION_ERROR_CODE.PURCHASE_CANCELLED,
      '1',
    ],
    [
      '결제 승인을 기다리면(Ask to Buy)',
      'purchase',
      storeFailure('payment-pending', '20'),
      SUBSCRIPTION_ERROR_CODE.PAYMENT_PENDING,
      '20',
    ],
    [
      '결제 중 연결이 끊기면',
      'purchase',
      storeFailure('network', '10'),
      SUBSCRIPTION_ERROR_CODE.NETWORK,
      '10',
    ],
    [
      '결제가 스토어 문제로 실패하면',
      'purchase',
      storeFailure('store-problem', '2'),
      SUBSCRIPTION_ERROR_CODE.PURCHASE_FAILED,
      '2',
    ],
    [
      '결제가 스토어 오류가 아닌 값으로 실패하면',
      'purchase',
      'unexpected',
      SUBSCRIPTION_ERROR_CODE.PURCHASE_FAILED,
      null,
    ],
    [
      '복원 중 오프라인이면',
      'restore',
      storeFailure('network', '35'),
      SUBSCRIPTION_ERROR_CODE.NETWORK,
      '35',
    ],
    [
      '복원 영수증이 다른 계정에 있으면',
      'restore',
      storeFailure('other', '7'),
      SUBSCRIPTION_ERROR_CODE.RESTORE_FAILED,
      '7',
    ],
    [
      '복원에서 취소가 와도 복원 실패로 본다',
      'restore',
      storeFailure('cancelled', '1'),
      SUBSCRIPTION_ERROR_CODE.RESTORE_FAILED,
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
});
