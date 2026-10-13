import type { BusinessError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { PURCHASES_ERROR_CODE } from 'react-native-purchases';

export const SubscriptionErrorCode = {
  NOT_CONFIGURED: 'SUBSCRIPTION_NOT_CONFIGURED',
  NO_OFFERINGS: 'SUBSCRIPTION_NO_OFFERINGS',
  FETCH_OFFERINGS_FAILED: 'SUBSCRIPTION_FETCH_OFFERINGS_FAILED',
  PURCHASE_CANCELLED: 'SUBSCRIPTION_PURCHASE_CANCELLED',
  PURCHASE_FAILED: 'SUBSCRIPTION_PURCHASE_FAILED',
  PAYMENT_PENDING: 'SUBSCRIPTION_PAYMENT_PENDING',
  RESTORE_FAILED: 'SUBSCRIPTION_RESTORE_FAILED',
} as const;

export type SubscriptionErrorCode =
  (typeof SubscriptionErrorCode)[keyof typeof SubscriptionErrorCode];

export class SubscriptionError extends Error implements BusinessError {
  override readonly name = 'SubscriptionError';

  constructor(
    public readonly code: SubscriptionErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const SubscriptionErrors = {
  notConfigured: () =>
    new SubscriptionError(
      SubscriptionErrorCode.NOT_CONFIGURED,
      t('subscription:errors.notConfigured'),
    ),

  noOfferings: () =>
    new SubscriptionError(SubscriptionErrorCode.NO_OFFERINGS, t('subscription:errors.noOfferings')),

  fetchOfferingsFailed: (reason?: string) =>
    new SubscriptionError(
      SubscriptionErrorCode.FETCH_OFFERINGS_FAILED,
      reason ?? t('subscription:errors.fetchOfferingsFailed'),
    ),

  purchaseCancelled: () =>
    new SubscriptionError(
      SubscriptionErrorCode.PURCHASE_CANCELLED,
      t('subscription:errors.purchaseCancelled'),
    ),

  purchaseFailed: (reason?: string) =>
    new SubscriptionError(
      SubscriptionErrorCode.PURCHASE_FAILED,
      reason ?? t('subscription:errors.purchaseFailed'),
    ),

  paymentPending: () =>
    new SubscriptionError(
      SubscriptionErrorCode.PAYMENT_PENDING,
      t('subscription:errors.paymentPending'),
    ),

  restoreFailed: (reason?: string) =>
    new SubscriptionError(
      SubscriptionErrorCode.RESTORE_FAILED,
      reason ?? t('subscription:errors.restoreFailed'),
    ),

  /** RevenueCat SDK 에러 → 도메인 SubscriptionError 변환 */
  fromPurchaseError: (error: unknown): SubscriptionError => {
    if (isRevenueCatCancelledError(error)) {
      return SubscriptionErrors.purchaseCancelled();
    }
    if (isRevenueCatPaymentPendingError(error)) {
      return SubscriptionErrors.paymentPending();
    }
    const message =
      error instanceof Error ? error.message : t('subscription:errors.purchaseFailed');
    return SubscriptionErrors.purchaseFailed(message);
  },
} as const;

export const isSubscriptionError = (error: unknown): error is SubscriptionError =>
  error instanceof SubscriptionError;

export const isPurchaseCancelledError = (error: unknown): boolean =>
  error instanceof SubscriptionError && error.code === SubscriptionErrorCode.PURCHASE_CANCELLED;

export const isPaymentPendingError = (error: unknown): boolean =>
  error instanceof SubscriptionError && error.code === SubscriptionErrorCode.PAYMENT_PENDING;

/** RevenueCat SDK 에러에서 사용자 취소 여부 확인 (code 기반, userCancelled는 deprecated) */
const isRevenueCatCancelledError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: string }).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;

/** RevenueCat SDK 에러에서 결제 승인 대기 여부 확인 (Ask to Buy 등) */
const isRevenueCatPaymentPendingError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: string }).code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR;
