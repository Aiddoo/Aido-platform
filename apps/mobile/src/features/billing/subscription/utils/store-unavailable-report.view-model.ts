import type { Severity } from '@src/core/observability/severity';
import { match } from 'ts-pattern';

import type { StoreUnavailable } from '../domains/subscription-failure.model';

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
