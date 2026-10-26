import { match } from 'ts-pattern';

import {
  type SubscriptionFailureCause,
  SubscriptionFailurePolicy,
} from '../../domains/subscription-failure.model';

/** 구독 화면에서 실패할 수 있는 곳. 앞의 둘은 불러오기, 뒤의 둘은 사용자가 누른 동작이다 */
export type SubscriptionLoadTarget = 'receipt' | 'plans';
export type SubscriptionActionTarget = 'purchase' | 'restore';

const FAILURE_TITLE_KEYS = {
  receipt: 'subscription:failure.title.receipt',
  plans: 'subscription:failure.title.plans',
  purchase: 'subscription:failure.title.purchase',
  restore: 'subscription:failure.title.restore',
} as const satisfies Record<SubscriptionLoadTarget | SubscriptionActionTarget, string>;

type FailureDescriptionKey =
  | 'subscription:failure.description.network'
  | 'subscription:failure.description.server'
  | 'subscription:failure.description.store'
  | 'subscription:failure.description.purchase'
  | 'subscription:failure.description.restore';

/** 무엇이 실패했는지(title), 무엇을 하면 되는지(description), 문의에 붙일 코드 */
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
    descriptionKey: toDescriptionKey(SubscriptionFailurePolicy.causeOf(error)),
    diagnosticCode: SubscriptionFailurePolicy.diagnosticCodeOf(error),
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
  return match(SubscriptionFailurePolicy.causeOf(error))
    .with('purchaseCancelled', () => ({ type: 'cancelled' as const }))
    .with('paymentPending', () => ({ type: 'paymentPending' as const }))
    .with('network', 'server', 'store', 'purchaseFailed', 'restoreFailed', () => ({
      type: 'contactSupport' as const,
      ...toSupportFailure(target, error),
    }))
    .exhaustive();
}
