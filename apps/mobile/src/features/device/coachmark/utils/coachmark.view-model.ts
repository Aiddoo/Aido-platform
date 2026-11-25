import { SECOND_MS } from '@src/shared/constants/time-units';
import { diffMs, type Instant } from '@src/shared/date/instant';

/** 자동으로 뜬 안내를 읽었다고 볼 수 있는 시간. 이보다 빨리 대상을 옮기면 아직 보지 못한 것으로 둔다 */
const COACHMARK_MIN_READ_MS = 2 * SECOND_MS;

export function isReadLongEnough(openedAt: Instant, now: Instant): boolean {
  return diffMs(now, openedAt) >= COACHMARK_MIN_READ_MS;
}
