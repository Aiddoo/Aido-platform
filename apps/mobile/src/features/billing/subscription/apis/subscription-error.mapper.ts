import { PurchasesGatewayError } from '@src/core/ports/purchases-gateway';
import { match } from 'ts-pattern';

import { type SubscriptionError, SubscriptionErrors } from '../domains/subscription.error';

export type StoreOperation = 'offerings' | 'purchase' | 'restore';

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
