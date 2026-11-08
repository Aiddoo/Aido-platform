import { match } from 'ts-pattern';

import {
  type SubscriptionFailureCause,
  SubscriptionFailurePolicy,
} from '../domains/subscription-failure.model';
import type { StoreUnavailable } from './offerings-availability';
import { getDiagnosticCode } from './subscription-diagnostic-code';

export type SubscriptionLoadTarget = 'receipt' | 'plans';
export type SubscriptionActionTarget = 'purchase' | 'restore';

const FAILURE_TITLE_KEYS = {
  receipt: 'subscription:failure.title.receipt',
  plans: 'subscription:failure.title.plans',
  purchase: 'subscription:failure.title.purchase',
  restore: 'subscription:failure.title.restore',
  storeUnavailable: 'subscription:failure.title.storeUnavailable',
  manage: 'subscription:failure.title.manage',
} as const satisfies Record<
  SubscriptionLoadTarget | SubscriptionActionTarget | 'storeUnavailable' | 'manage',
  string
>;

type FailureDescriptionKey =
  | 'subscription:failure.description.network'
  | 'subscription:failure.description.server'
  | 'subscription:failure.description.store'
  | 'subscription:failure.description.purchase'
  | 'subscription:failure.description.restore'
  | 'subscription:failure.description.storeSetup'
  | 'subscription:failure.description.storeTemporary';

export interface SubscriptionSupportFailure {
  titleKey: (typeof FAILURE_TITLE_KEYS)[keyof typeof FAILURE_TITLE_KEYS];
  descriptionKey: FailureDescriptionKey;
  diagnosticCode: string;
}

export type SubscriptionActionFailure =
  | { type: 'cancelled' }
  | { type: 'paymentPending' }
  | ({ type: 'contactSupport' } & SubscriptionSupportFailure);

function toDescriptionKey(cause: SubscriptionFailureCause): FailureDescriptionKey {
  return match(cause)
    .with('network', () => 'subscription:failure.description.network' as const)
    .with('store', () => 'subscription:failure.description.store' as const)
    .with('purchaseFailed', () => 'subscription:failure.description.purchase' as const)
    .with('restoreFailed', () => 'subscription:failure.description.restore' as const)
    .with(
      'server',
      'purchaseCancelled',
      'paymentPending',
      () => 'subscription:failure.description.server' as const,
    )
    .exhaustive();
}

function toSupportFailure(
  target: SubscriptionLoadTarget | SubscriptionActionTarget,
  error: unknown,
): SubscriptionSupportFailure {
  return {
    titleKey: FAILURE_TITLE_KEYS[target],
    descriptionKey: toDescriptionKey(SubscriptionFailurePolicy.getFailureCause(error)),
    diagnosticCode: getDiagnosticCode(error),
  };
}

export function toSubscriptionLoadFailure(
  target: SubscriptionLoadTarget,
  error: unknown,
): SubscriptionSupportFailure {
  return toSupportFailure(target, error);
}

export function toSubscriptionActionFailure(
  target: SubscriptionActionTarget,
  error: unknown,
): SubscriptionActionFailure {
  return match(SubscriptionFailurePolicy.getFailureCause(error))
    .with('purchaseCancelled', () => ({ type: 'cancelled' as const }))
    .with('paymentPending', () => ({ type: 'paymentPending' as const }))
    .with('network', 'server', 'store', 'purchaseFailed', 'restoreFailed', () => ({
      type: 'contactSupport' as const,
      ...toSupportFailure(target, error),
    }))
    .exhaustive();
}

export function toSubscriptionStoreUnavailableFailure({
  kind,
  diagnosticCode,
}: StoreUnavailable): SubscriptionSupportFailure {
  return {
    titleKey: FAILURE_TITLE_KEYS.storeUnavailable,
    diagnosticCode,
    ...match(kind)
      .with('setup', () => ({
        descriptionKey: 'subscription:failure.description.storeSetup' as const,
      }))
      .with('temporary', () => ({
        descriptionKey: 'subscription:failure.description.storeTemporary' as const,
      }))
      .exhaustive(),
  };
}

export const SUBSCRIPTION_MANAGE_OPEN_FAILURE = {
  titleKey: FAILURE_TITLE_KEYS.manage,
  diagnosticCode: 'SUBSCRIPTION_MANAGE_OPEN_FAILED',
} as const satisfies Pick<SubscriptionSupportFailure, 'titleKey' | 'diagnosticCode'>;
