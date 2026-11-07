import type { AiReport } from '../schemas/report.schema';

/** 지난 기간 완료율이 없으면(첫 리포트) 비교할 값이 없다 */
function getCompletionRateChange(
  stats: Pick<AiReport['stats'], 'completionRate' | 'prevCompletionRate'>,
): number | null {
  return stats.prevCompletionRate != null ? stats.completionRate - stats.prevCompletionRate : null;
}

type CompletionLevel = 'high' | 'medium' | 'low';

const HIGH_COMPLETION_RATE = 80;
const MEDIUM_COMPLETION_RATE = 50;

/** 요일별 완료율을 얼마나 잘 해낸 요일로 볼지. 80% 이상은 높음, 50% 이상은 보통이다 */
function getCompletionLevel(rate: number): CompletionLevel {
  if (rate >= HIGH_COMPLETION_RATE) {
    return 'high';
  }
  if (rate >= MEDIUM_COMPLETION_RATE) {
    return 'medium';
  }
  return 'low';
}

export const AiReportPolicy = { getCompletionRateChange, getCompletionLevel } as const;
