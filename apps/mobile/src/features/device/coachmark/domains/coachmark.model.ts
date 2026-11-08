import type { CoachmarkDisplay } from '../schemas/coachmark.schema';

/** 자동으로 뜬 안내를 읽었다고 볼 수 있는 시간. 이보다 빨리 대상을 옮기면 아직 보지 못한 것으로 둔다 */
const COACHMARK_MIN_READ_MS = 2_000;

function isReadLongEnough(display: Pick<CoachmarkDisplay, 'openedAtMs'>, nowMs: number): boolean {
  return nowMs - display.openedAtMs >= COACHMARK_MIN_READ_MS;
}

export const CoachmarkPolicy = { isReadLongEnough } as const;
