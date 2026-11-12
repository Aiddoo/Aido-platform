import { match } from 'ts-pattern';

import {
  type SubscriptionFailureCause,
  SubscriptionFailurePolicy,
} from '../domains/subscription-failure.model';
import type { StoreUnavailable } from './offerings-availability.view-model';
import { getDiagnosticCode } from './subscription-diagnostic.view-model';

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

/** 사용자가 직접 취소했거나 결제 승인을 기다리는 중이면 문의로 안내하지 않는다 */
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

/** 영수증·요금제를 불러오지 못하면 늘 다시 시도와 문의를 함께 보여 준다 */
export function toSubscriptionLoadFailure(
  target: SubscriptionLoadTarget,
  error: unknown,
): SubscriptionSupportFailure {
  return toSupportFailure(target, error);
}

/** 결제·복원이 실패했을 때 조용히 넘길지, 승인 대기를 알릴지, 문의로 안내할지 정한다 */
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
