import type { VoiceDurationBucket } from '@src/shared/observability/telemetry-keys';

const SECONDS = { half: 30, threeMinutes: 180, tenMinutes: 600 } as const;

/** 말한 길이는 정확한 값 대신 구간으로만 남긴다 */
export function getDurationBucket(elapsedMs: number): VoiceDurationBucket {
  const seconds = elapsedMs / 1_000;
  if (seconds < SECONDS.half) {
    return 'lt_30s';
  }
  if (seconds < SECONDS.threeMinutes) {
    return '30s_3m';
  }
  return seconds < SECONDS.tenMinutes ? '3m_10m' : '10m_30m';
}
