import { NetworkError, TimeoutError } from '@src/shared/errors';
import { match, P } from 'ts-pattern';

import { SubscriptionError, SubscriptionErrorCode } from './subscription.error';

/**
 * 구독 화면이 실패를 어떻게 안내할지 정하는 원인.
 * - network: 기기 연결 문제라 연결을 확인하면 풀린다
 * - server: Aido 서버나 응답 문제라 잠시 뒤 다시 하면 풀린다
 * - store: 스토어(앱스토어·플레이)에 닿지 못했거나 팔 요금제가 없다
 */
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
    .with(SubscriptionErrorCode.NETWORK, () => 'network' as const)
    .with(
      SubscriptionErrorCode.STORE_UNAVAILABLE,
      SubscriptionErrorCode.STORE_PROBLEM,
      SubscriptionErrorCode.OFFERINGS_UNAVAILABLE,
      () => 'store' as const,
    )
    .with(SubscriptionErrorCode.PURCHASE_CANCELLED, () => 'purchaseCancelled' as const)
    .with(SubscriptionErrorCode.PAYMENT_PENDING, () => 'paymentPending' as const)
    .with(SubscriptionErrorCode.PURCHASE_FAILED, () => 'purchaseFailed' as const)
    .with(SubscriptionErrorCode.RESTORE_FAILED, () => 'restoreFailed' as const)
    .exhaustive();
}

function getFailureCause(error: unknown): SubscriptionFailureCause {
  return match(error)
    .with(P.instanceOf(SubscriptionError), getSubscriptionErrorCause)
    .with(P.instanceOf(NetworkError), P.instanceOf(TimeoutError), () => 'network' as const)
    .otherwise(() => 'server' as const);
}

/**
 * 스토어를 쓸 수 없어 요금제를 보여 줄 수 없는 상태의 종류. 예상한 상태라 오류 경계로 보내지 않고 화면이 안내한다.
 * - setup: 앱·스토어 설정 문제다
 * - temporary: 스토어가 잠시 응답하지 못했다
 */
function getStoreUnavailableKind(error: unknown): 'setup' | 'temporary' | null {
  return match(error)
    .with(
      P.instanceOf(SubscriptionError).and({ code: SubscriptionErrorCode.STORE_UNAVAILABLE }),
      () => 'setup' as const,
    )
    .with(
      P.instanceOf(SubscriptionError).and({ code: SubscriptionErrorCode.STORE_PROBLEM }),
      () => 'temporary' as const,
    )
    .otherwise(() => null);
}

export const SubscriptionFailurePolicy = {
  getFailureCause,
  getStoreUnavailableKind,
} as const;
