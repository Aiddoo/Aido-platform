import type { Result } from '@src/core/errors/result';
import type { Severity } from '@src/core/observability/severity';
import { match } from 'ts-pattern';

import { SubscriptionFailurePolicy } from '../domains/subscription-failure.model';
import type { SubscriptionError } from '../domains/subscription.error';
import { type SubscriptionOffering } from '../domains/subscription.model';
import { getDiagnosticCode } from './subscription-diagnostic.view-model';

export interface StoreUnavailable {
  kind: 'setup' | 'temporary';
  diagnosticCode: string;
}

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

  const kind = SubscriptionFailurePolicy.findStoreUnavailableKind(result.error);
  if (kind == null) {
    throw result.error;
  }
  return {
    status: 'unavailable',
    unavailable: { kind, diagnosticCode: getDiagnosticCode(result.error) },
  };
}

export type StoreUnavailableReport =
  | { channel: 'log' }
  | { channel: 'event'; severity: Extract<Severity, 'error' | 'warning'> };

/** 배포 빌드의 설정 문제는 매출이 막혀 error, 일시 장애는 warning이다. 개발 빌드는 Test Store라 로그만 남긴다 */
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
