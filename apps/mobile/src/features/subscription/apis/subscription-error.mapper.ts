import { PurchasesGatewayError } from '@src/core/ports/purchases';
import { match } from 'ts-pattern';

import { type SubscriptionError, SubscriptionErrors } from '../domains/subscription.error';

/** 스토어 SDK를 부른 작업. 같은 실패라도 작업마다 사용자에게 뜻하는 바가 다르다 */
export type StoreOperation = 'offerings' | 'purchase' | 'restore';

/** 스토어 실패를 도메인 오류로 바꾼다. 화면은 SDK 코드를 모른다 */
export function toSubscriptionError(operation: StoreOperation, error: unknown): SubscriptionError {
  const { kind, storeErrorCode } =
    error instanceof PurchasesGatewayError
      ? error
      : { kind: 'other' as const, storeErrorCode: null };

  return match({ operation, kind })
    .with({ kind: 'network' }, () => SubscriptionErrors.network(storeErrorCode))
    .with({ operation: 'purchase', kind: 'cancelled' }, () =>
      SubscriptionErrors.purchaseCancelled(storeErrorCode),
    )
    .with({ operation: 'purchase', kind: 'payment-pending' }, () =>
      SubscriptionErrors.paymentPending(storeErrorCode),
    )
    .with({ operation: 'offerings', kind: 'store-setup' }, () =>
      SubscriptionErrors.storeUnavailable(storeErrorCode),
    )
    .with({ operation: 'offerings', kind: 'store-problem' }, () =>
      SubscriptionErrors.storeProblem(storeErrorCode),
    )
    .with({ operation: 'offerings' }, () => SubscriptionErrors.offeringsUnavailable(storeErrorCode))
    .with({ operation: 'purchase' }, () => SubscriptionErrors.purchaseFailed(storeErrorCode))
    .with({ operation: 'restore' }, () => SubscriptionErrors.restoreFailed(storeErrorCode))
    .exhaustive();
}
