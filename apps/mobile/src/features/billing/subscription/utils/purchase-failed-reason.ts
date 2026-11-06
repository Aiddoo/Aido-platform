import type { SubscriptionFailureCause } from '../domains/subscription-failure.model';

/** 문의로 안내한 결제 실패의 원인. 직접 취소·승인 대기는 실패가 아니라 null이다 */
export type PurchaseFailedReason = 'network' | 'server' | 'store_unavailable' | 'store_error';

const PURCHASE_FAILED_REASONS = {
  network: 'network',
  server: 'server',
  store: 'store_unavailable',
  purchaseFailed: 'store_error',
  restoreFailed: 'store_error',
  purchaseCancelled: null,
  paymentPending: null,
} as const satisfies Record<SubscriptionFailureCause, PurchaseFailedReason | null>;

export function toPurchaseFailedReason(
  cause: SubscriptionFailureCause,
): PurchaseFailedReason | null {
  return PURCHASE_FAILED_REASONS[cause];
}
