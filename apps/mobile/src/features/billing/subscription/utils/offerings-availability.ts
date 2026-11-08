import type { Result } from '@src/core/errors/result';
import type { Severity } from '@src/core/observability/severity';
import { match } from 'ts-pattern';

import { SubscriptionFailurePolicy } from '../domains/subscription-failure.model';
import type { SubscriptionError } from '../domains/subscription.error';
import { type SubscriptionOffering } from '../domains/subscription.model';
import { getDiagnosticCode } from './subscription-diagnostic-code';

export interface StoreUnavailable {
  kind: 'setup' | 'temporary';
  diagnosticCode: string;
}

export type OfferingsAvailability =
  | { status: 'available'; offering: SubscriptionOffering }
  | { status: 'unavailable'; unavailable: StoreUnavailable };

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

// 배포 빌드 설정 문제는 매출이 막혀 error, 일시 무응답은 warning, 개발 빌드는 로그만
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
