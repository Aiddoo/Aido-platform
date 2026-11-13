import type { Result } from '@src/core/errors/result';
import { NetworkError, TimeoutError } from '@src/shared/errors';
import { match, P } from 'ts-pattern';

import {
  getSubscriptionDiagnosticCode,
  SUBSCRIPTION_ERROR_CODE,
  SubscriptionError,
} from './subscription.error';
import type { SubscriptionOffering } from './subscription.model';

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

export interface StoreUnavailable {
  kind: 'setup' | 'temporary';
  diagnosticCode: string;
}

export type OfferingsAvailability =
  | { status: 'available'; offering: SubscriptionOffering }
  | { status: 'unavailable'; unavailable: StoreUnavailable };

/** 예상한 상태라 오류 경계로 보내지 않고 화면이 안내한다. setup은 설정 문제, temporary는 스토어 일시 장애다 */
function findStoreUnavailableKind(error: unknown): StoreUnavailable['kind'] | null {
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

/** 스토어를 쓸 수 없는 상태는 화면이 안내하고, 그 밖의 실패는 오류 경계로 던진다 */
export function toOfferingsAvailability(
  result: Result<SubscriptionOffering, SubscriptionError>,
): OfferingsAvailability {
  if (result.ok) {
    return { status: 'available', offering: result.value };
  }

  const kind = findStoreUnavailableKind(result.error);
  if (kind == null) {
    throw result.error;
  }
  return {
    status: 'unavailable',
    unavailable: { kind, diagnosticCode: getSubscriptionDiagnosticCode(result.error) },
  };
}

export const SubscriptionFailurePolicy = {
  getFailureCause,
  findStoreUnavailableKind,
} as const;
