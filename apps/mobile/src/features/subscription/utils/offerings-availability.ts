import type { Severity } from '@src/core/ports/severity';
import type { Result } from '@src/shared/errors/result';
import { match } from 'ts-pattern';

import {
  type StoreUnavailable,
  SubscriptionFailurePolicy,
} from '../domains/subscription-failure.model';
import type { SubscriptionError } from '../domains/subscription.error';
import type { SubscriptionOffering } from '../domains/subscription.model';

export type OfferingsAvailability =
  | { status: 'available'; offering: SubscriptionOffering }
  | { status: 'unavailable'; unavailable: StoreUnavailable };

/** 스토어를 쓸 수 없는 상태는 화면이 안내하고, 그 밖의 실패는 오류 경계로 던진다 */
export function toOfferingsAvailability(
  result: Result<SubscriptionOffering, SubscriptionError>,
): OfferingsAvailability {
  if (result.ok) {
    return { status: 'available', offering: result.value };
  }

  const unavailable = SubscriptionFailurePolicy.storeUnavailableOf(result.error);
  if (unavailable == null) {
    throw result.error;
  }

  return { status: 'unavailable', unavailable };
}

export type StoreUnavailableReport =
  | { channel: 'log' }
  | { channel: 'event'; severity: Extract<Severity, 'error' | 'warning'> };

/**
 * 스토어를 쓸 수 없을 때 남길 신호. 배포 빌드의 설정 문제는 매출이 막히는 일이라 error,
 * 스토어가 잠시 응답하지 못한 것은 warning이다. 개발 빌드는 Test Store라 로그만 남긴다.
 */
export function toStoreUnavailableReport(
  kind: StoreUnavailable['kind'],
  { isDebugBuild }: { isDebugBuild: boolean },
): StoreUnavailableReport {
  if (isDebugBuild) {
    return { channel: 'log' };
  }

  return match(kind)
    .with('setup', () => ({ channel: 'event' as const, severity: 'error' as const }))
    .with('temporary', () => ({ channel: 'event' as const, severity: 'warning' as const }))
    .exhaustive();
}
