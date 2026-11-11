import { MINUTE_MS } from '@src/shared/constants/time-units';
import { getDeviceTimezone } from '@src/shared/infra/localization/device-timezone';

import { addDaysToDateKey } from './date-key';
import { fromEpochMs, type Instant, toEpochMs } from './instant';
import { instantToDate } from './native-date';
import { getStartOfDateKey, getZoneOffsetMs, toDateKey } from './zoned';

export type LocalDateState = {
  currentLocalDate: Date;
  currentLocalDateKey: string;
  currentTimeZone: string;
  currentUtcOffsetMinutes: number;
};

const MIDNIGHT_GRACE_MS = 100;

/** 렌더 중에는 쓰지 않고 이벤트·저장 시점에 부른다 */
export function getNowInstant(): Instant {
  return fromEpochMs(Date.now());
}

export function createLocalDateState(now: Instant, timeZone: string): LocalDateState {
  return {
    currentLocalDate: instantToDate(now),
    currentLocalDateKey: toDateKey(now, timeZone),
    currentTimeZone: timeZone,
    currentUtcOffsetMinutes: getZoneOffsetMs(toEpochMs(now), timeZone) / MINUTE_MS,
  };
}

/** LocalDateProvider와 Provider 밖의 위젯 렌더러가 같은 기기 시간대 규칙으로 오늘을 계산한다. */
export function readDeviceLocalDateState(now: Instant = getNowInstant()): LocalDateState {
  return createLocalDateState(now, getDeviceTimezone());
}

export function isSameLocalDateState(previous: LocalDateState, next: LocalDateState): boolean {
  return (
    previous.currentLocalDateKey === next.currentLocalDateKey &&
    previous.currentTimeZone === next.currentTimeZone &&
    previous.currentUtcOffsetMinutes === next.currentUtcOffsetMinutes
  );
}

/** 자정이 없거나 두 번 오는 DST 날짜도 다음 날짜의 첫 순간이다 */
export function getNextLocalMidnight(now: Instant, timeZone: string): Instant {
  return getStartOfDateKey(addDaysToDateKey(toDateKey(now, timeZone), 1), timeZone);
}

export function millisecondsUntilNextLocalMidnight(now: Instant, timeZone: string): number {
  return Math.max(
    MIDNIGHT_GRACE_MS,
    toEpochMs(getNextLocalMidnight(now, timeZone)) - toEpochMs(now) + MIDNIGHT_GRACE_MS,
  );
}
