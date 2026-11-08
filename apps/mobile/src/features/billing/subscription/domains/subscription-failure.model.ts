import { NetworkError, TimeoutError } from '@src/shared/errors';
import { match, P } from 'ts-pattern';

import { SUBSCRIPTION_ERROR_CODE, SubscriptionError } from './subscription.error';

export type SubscriptionFailureCause =
  | 'network'
  | 'server'
  | 'store'
  | 'purchaseCancelled'
  | 'paymentPending'
  | 'purchaseFailed'
  | 'restoreFailed';

function getSubscriptionErrorCause(error: SubscriptionError): SubscriptionFailureCause {
  return match(error.code)
    .with(SUBSCRIPTION_ERROR_CODE.NETWORK, () => 'network' as const)
    .with(
      SUBSCRIPTION_ERROR_CODE.STORE_UNAVAILABLE,
      SUBSCRIPTION_ERROR_CODE.STORE_PROBLEM,
      SUBSCRIPTION_ERROR_CODE.OFFERINGS_UNAVAILABLE,
      () => 'store' as const,
    )
    .with(SUBSCRIPTION_ERROR_CODE.PURCHASE_CANCELLED, () => 'purchaseCancelled' as const)
    .with(SUBSCRIPTION_ERROR_CODE.PAYMENT_PENDING, () => 'paymentPending' as const)
    .with(SUBSCRIPTION_ERROR_CODE.PURCHASE_FAILED, () => 'purchaseFailed' as const)
    .with(SUBSCRIPTION_ERROR_CODE.RESTORE_FAILED, () => 'restoreFailed' as const)
    .exhaustive();
}

function getFailureCause(error: unknown): SubscriptionFailureCause {
  return match(error)
    .with(P.instanceOf(SubscriptionError), getSubscriptionErrorCause)
    .with(P.instanceOf(NetworkError), P.instanceOf(TimeoutError), () => 'network' as const)
    .otherwise(() => 'server' as const);
}

function findStoreUnavailableKind(error: unknown): 'setup' | 'temporary' | null {
  return match(error)
    .with(
      P.instanceOf(SubscriptionError).and({ code: SUBSCRIPTION_ERROR_CODE.STORE_UNAVAILABLE }),
      () => 'setup' as const,
    )
    .with(
      P.instanceOf(SubscriptionError).and({ code: SUBSCRIPTION_ERROR_CODE.STORE_PROBLEM }),
      () => 'temporary' as const,
    )
    .otherwise(() => null);
}

export const SubscriptionFailurePolicy = {
  getFailureCause,
  findStoreUnavailableKind,
} as const;
