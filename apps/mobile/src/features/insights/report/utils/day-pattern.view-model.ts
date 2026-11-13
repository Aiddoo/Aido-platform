import type { DayPatternItem } from '../domains/report.model';

type DayPatternLevel = 'high' | 'medium' | 'low';

const HIGH_COMPLETION_RATE = 80;
const MEDIUM_COMPLETION_RATE = 50;

// 요일 칸의 진하기. 완료율 80% 이상은 높음, 50% 이상은 보통
export function getDayPatternLevel(dayPattern: DayPatternItem): DayPatternLevel {
  if (dayPattern.rate >= HIGH_COMPLETION_RATE) {
    return 'high';
  }
  if (dayPattern.rate >= MEDIUM_COMPLETION_RATE) {
    return 'medium';
  }
  return 'low';
}
