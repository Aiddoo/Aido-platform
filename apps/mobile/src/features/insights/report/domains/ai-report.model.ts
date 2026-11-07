import type { AiReport } from '../schemas/report.schema';

/** 지난 기간 완료율이 없으면(첫 리포트) 비교할 값이 없다 */
function getCompletionRateChange(
  stats: Pick<AiReport['stats'], 'completionRate' | 'prevCompletionRate'>,
): number | null {
  return stats.prevCompletionRate != null ? stats.completionRate - stats.prevCompletionRate : null;
}

export const AiReportPolicy = { getCompletionRateChange } as const;
