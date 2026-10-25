import type { BusinessError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';

export const SubscriptionErrorCode = {
  /** 스토어 SDK를 쓸 수 없다(키 없음·초기화 실패·스토어 설정 문제) */
  STORE_UNAVAILABLE: 'SUBSCRIPTION_STORE_UNAVAILABLE',
  /** 스토어에는 닿았지만 팔 수 있는 요금제를 받지 못했다 */
  OFFERINGS_UNAVAILABLE: 'SUBSCRIPTION_OFFERINGS_UNAVAILABLE',
  /** 기기 연결 때문에 스토어에 닿지 못했다 */
  NETWORK: 'SUBSCRIPTION_NETWORK',
  PURCHASE_CANCELLED: 'SUBSCRIPTION_PURCHASE_CANCELLED',
  PAYMENT_PENDING: 'SUBSCRIPTION_PAYMENT_PENDING',
  PURCHASE_FAILED: 'SUBSCRIPTION_PURCHASE_FAILED',
  RESTORE_FAILED: 'SUBSCRIPTION_RESTORE_FAILED',
} as const;

export type SubscriptionErrorCode =
  (typeof SubscriptionErrorCode)[keyof typeof SubscriptionErrorCode];

export class SubscriptionError extends Error implements BusinessError {
  override readonly name = 'SubscriptionError';

  constructor(
    public readonly code: SubscriptionErrorCode,
    message: string,
    /** 스토어 SDK가 준 원래 오류 코드. 문의·진단에만 쓰고 화면 분기는 `code`로 한다 */
    public readonly storeErrorCode: string | null = null,
  ) {
    super(message);
  }
}

export const SubscriptionErrors = {
  storeUnavailable: (storeErrorCode?: string | null) =>
    new SubscriptionError(
      SubscriptionErrorCode.STORE_UNAVAILABLE,
      t('subscription:errors.storeUnavailable'),
      storeErrorCode,
    ),

  offeringsUnavailable: (storeErrorCode?: string | null) =>
    new SubscriptionError(
      SubscriptionErrorCode.OFFERINGS_UNAVAILABLE,
      t('subscription:errors.offeringsUnavailable'),
      storeErrorCode,
    ),

  network: (storeErrorCode?: string | null) =>
    new SubscriptionError(
      SubscriptionErrorCode.NETWORK,
      t('subscription:errors.network'),
      storeErrorCode,
    ),

  purchaseCancelled: (storeErrorCode?: string | null) =>
    new SubscriptionError(
      SubscriptionErrorCode.PURCHASE_CANCELLED,
      t('subscription:errors.purchaseCancelled'),
      storeErrorCode,
    ),

  paymentPending: (storeErrorCode?: string | null) =>
    new SubscriptionError(
      SubscriptionErrorCode.PAYMENT_PENDING,
      t('subscription:errors.paymentPending'),
      storeErrorCode,
    ),

  purchaseFailed: (storeErrorCode?: string | null) =>
    new SubscriptionError(
      SubscriptionErrorCode.PURCHASE_FAILED,
      t('subscription:errors.purchaseFailed'),
      storeErrorCode,
    ),

  restoreFailed: (storeErrorCode?: string | null) =>
    new SubscriptionError(
      SubscriptionErrorCode.RESTORE_FAILED,
      t('subscription:errors.restoreFailed'),
      storeErrorCode,
    ),
} as const;

export const isSubscriptionError = (error: unknown): error is SubscriptionError =>
  error instanceof SubscriptionError;
