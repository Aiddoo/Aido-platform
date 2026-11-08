import { type Instant, toEpochMs } from '@src/shared/date/instant';

interface DiagnosticCodeInput {
  platform: string;
  appVersion: string | null;
  occurredAt: Instant;
}

/** 사용자·기기 식별자 없이 플랫폼·앱 버전·발생 시각만 담는다 */
export function createDiagnosticCode({
  platform,
  appVersion,
  occurredAt,
}: DiagnosticCodeInput): string {
  return [
    platform.toUpperCase(),
    appVersion ?? 'unknown',
    toEpochMs(occurredAt).toString(36).toUpperCase(),
  ].join('-');
}
