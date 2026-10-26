import {
  isApiError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from '@src/shared/errors';
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

function causeOfSubscriptionError(error: SubscriptionError): SubscriptionFailureCause {
  return match(error.code)
    .with(SubscriptionErrorCode.NETWORK, () => 'network' as const)
    .with(
      SubscriptionErrorCode.STORE_UNAVAILABLE,
      SubscriptionErrorCode.OFFERINGS_UNAVAILABLE,
      () => 'store' as const,
    )
    .with(SubscriptionErrorCode.PURCHASE_CANCELLED, () => 'purchaseCancelled' as const)
    .with(SubscriptionErrorCode.PAYMENT_PENDING, () => 'paymentPending' as const)
    .with(SubscriptionErrorCode.PURCHASE_FAILED, () => 'purchaseFailed' as const)
    .with(SubscriptionErrorCode.RESTORE_FAILED, () => 'restoreFailed' as const)
    .exhaustive();
}

export const SubscriptionFailurePolicy = {
  /** 던져진 값이 무엇이든 사용자가 할 수 있는 일이 같은 원인으로 묶는다 */
  causeOf(error: unknown): SubscriptionFailureCause {
    return match(error)
      .with(P.instanceOf(SubscriptionError), causeOfSubscriptionError)
      .with(P.instanceOf(NetworkError), P.instanceOf(TimeoutError), () => 'network' as const)
      .otherwise(() => 'server' as const);
  },

  /**
   * 문의에 붙일 짧은 오류 코드. 메시지·사용자 정보 없이 원인을 찾을 만큼만 담는다.
   * 스토어 SDK 코드가 있으면 괄호로 덧붙인다.
   */
  diagnosticCodeOf(error: unknown): string {
    return match(error)
      .with(P.instanceOf(SubscriptionError), ({ code, storeErrorCode }) =>
        storeErrorCode == null ? code : `${code} (${storeErrorCode})`,
      )
      .with(P.when(isApiError), ({ code }) => code)
      .with(P.instanceOf(NetworkError), () => 'NETWORK')
      .with(P.instanceOf(TimeoutError), () => 'TIMEOUT')
      .with(P.instanceOf(ServerError), ({ statusCode }) => `SERVER_${statusCode}`)
      .with(P.instanceOf(ParseError), () => 'INVALID_RESPONSE')
      .otherwise(() => 'UNKNOWN');
  },
};
