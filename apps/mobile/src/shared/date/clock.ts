import { MINUTE_MS } from '@src/shared/constants/time-units';
import { getAppTimezone } from '@src/shared/infra/localization/app-timezone';

import type { DateKey } from './date-key';
import { fromEpochMs, type Instant, toEpochMs } from './instant';
import { getNextLocalMidnight, getZoneOffsetMs, toDateKey } from './zoned';

export type LocalDateState = {
  currentLocalDateKey: DateKey;
  currentTimezone: string;
  currentUtcOffsetMinutes: number;
};

const MIDNIGHT_GRACE_MS = 100;

/** 렌더 중에는 쓰지 않고 이벤트·저장 시점에 부른다 */
export function getNowInstant(): Instant {
  return fromEpochMs(Date.now());
}

/** LocalDateProvider와 React 밖(위젯·서비스)이 같은 앱 시간대 규칙으로 읽는 길 하나다. React 안의 오늘은 useTodayKey다 */
export function readLocalDateState({
  now = getNowInstant(),
  timezone = getAppTimezone(),
}: { now?: Instant; timezone?: string } = {}): LocalDateState {
  return {
    currentLocalDateKey: toDateKey(now, timezone),
    currentTimezone: timezone,
    currentUtcOffsetMinutes: getZoneOffsetMs(toEpochMs(now), timezone) / MINUTE_MS,
  };
}

export function isSameLocalDateState(previous: LocalDateState, next: LocalDateState): boolean {
  return (
    previous.currentLocalDateKey === next.currentLocalDateKey &&
    previous.currentTimezone === next.currentTimezone &&
    previous.currentUtcOffsetMinutes === next.currentUtcOffsetMinutes
  );
}

export function millisecondsUntilNextLocalMidnight(now: Instant, timezone: string): number {
  return Math.max(
    MIDNIGHT_GRACE_MS,
    toEpochMs(getNextLocalMidnight(now, timezone)) - toEpochMs(now) + MIDNIGHT_GRACE_MS,
  );
}
