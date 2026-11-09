import { NetworkError, TimeoutError } from '@src/shared/errors';
import { match, P } from 'ts-pattern';

import { SUBSCRIPTION_ERROR_CODE, SubscriptionError } from './subscription.error';

/** network는 연결을 확인하면, server는 잠시 뒤 다시 하면 풀린다. store는 스토어에 닿지 못했거나 팔 요금제가 없다 */
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

/** 예상한 상태라 오류 경계로 보내지 않고 화면이 안내한다. setup은 설정 문제, temporary는 스토어 일시 장애다 */
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
