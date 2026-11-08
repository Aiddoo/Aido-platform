import { BusinessError } from '@src/shared/errors';

export const SUBSCRIPTION_ERROR_CODE = {
  STORE_UNAVAILABLE: 'SUBSCRIPTION_STORE_UNAVAILABLE',
  // 설정 문제와 달리 나중에 다시 하면 풀릴 수 있다
  STORE_PROBLEM: 'SUBSCRIPTION_STORE_PROBLEM',
  OFFERINGS_UNAVAILABLE: 'SUBSCRIPTION_OFFERINGS_UNAVAILABLE',
  NETWORK: 'SUBSCRIPTION_NETWORK',
  PURCHASE_CANCELLED: 'SUBSCRIPTION_PURCHASE_CANCELLED',
  PAYMENT_PENDING: 'SUBSCRIPTION_PAYMENT_PENDING',
  PURCHASE_FAILED: 'SUBSCRIPTION_PURCHASE_FAILED',
  RESTORE_FAILED: 'SUBSCRIPTION_RESTORE_FAILED',
} as const;

export type SubscriptionErrorCode =
  (typeof SUBSCRIPTION_ERROR_CODE)[keyof typeof SUBSCRIPTION_ERROR_CODE];

export class SubscriptionError extends BusinessError<SubscriptionErrorCode> {
  // Sentry breadcrumb 메시지가 오류 이름을 쓴다
  override readonly name: string = 'SubscriptionError';

  constructor(
    code: SubscriptionErrorCode,
    // 문의·진단에만 쓰고 화면 분기는 code로 한다
    readonly storeErrorCode: string | null = null,
  ) {
    super(code);
  }
}

export const SubscriptionErrors = {
  storeUnavailable: (storeErrorCode?: string | null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.STORE_UNAVAILABLE, storeErrorCode),

  storeProblem: (storeErrorCode?: string | null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.STORE_PROBLEM, storeErrorCode),

  offeringsUnavailable: (storeErrorCode?: string | null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.OFFERINGS_UNAVAILABLE, storeErrorCode),

  network: (storeErrorCode?: string | null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.NETWORK, storeErrorCode),

  purchaseCancelled: (storeErrorCode?: string | null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.PURCHASE_CANCELLED, storeErrorCode),

  paymentPending: (storeErrorCode?: string | null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.PAYMENT_PENDING, storeErrorCode),

  purchaseFailed: (storeErrorCode?: string | null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.PURCHASE_FAILED, storeErrorCode),

  restoreFailed: (storeErrorCode?: string | null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.RESTORE_FAILED, storeErrorCode),
} as const;
