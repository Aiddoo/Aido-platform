import { getDeviceTimezone } from '@src/shared/infra/localization/device-timezone';
import { minBy } from 'es-toolkit';

import { addDaysToDateKey } from './date-key';
import { getZoneOffsetMs, toDateKey } from './instant';

export type LocalDateState = {
  currentLocalDate: Date;
  currentLocalDateKey: string;
  currentTimeZone: string;
  currentUtcOffsetMinutes: number;
};

const MIDNIGHT_GRACE_MS = 100;

export function createLocalDateState(
  now: Date,
  timeZone: string,
  utcOffsetMinutes: number,
): LocalDateState {
  return {
    currentLocalDate: new Date(now),
    currentLocalDateKey: toDateKey(now, timeZone),
    currentTimeZone: timeZone,
    currentUtcOffsetMinutes: utcOffsetMinutes,
  };
}

/** LocalDateProvider와 Provider 밖의 위젯 렌더러가 같은 기기 시간대 규칙으로 오늘을 계산한다. */
export function readDeviceLocalDateState(now: Date = new Date()): LocalDateState {
  return createLocalDateState(now, getDeviceTimezone(), -now.getTimezoneOffset());
}

export function isSameLocalDateState(previous: LocalDateState, next: LocalDateState): boolean {
  return (
    previous.currentLocalDateKey === next.currentLocalDateKey &&
    previous.currentTimeZone === next.currentTimeZone &&
    previous.currentUtcOffsetMinutes === next.currentUtcOffsetMinutes
  );
}

/** 자정이 없거나 두 번 오는 DST 날짜가 있어 다음 날짜 key에 속하는 가장 이른 후보를 고른다 */
export function getNextLocalMidnight(now: Date, timeZone: string): Date {
  const nextDateKey = addDaysToDateKey(toDateKey(now, timeZone), 1);
  const wallMidnightMs = Date.parse(`${nextDateKey}T00:00:00Z`);
  const firstGuessMs = wallMidnightMs - getZoneOffsetMs(wallMidnightMs, timeZone);
  const secondGuessMs = wallMidnightMs - getZoneOffsetMs(firstGuessMs, timeZone);
  const startsNextDate = (instantMs: number) =>
    instantMs > now.getTime() && toDateKey(new Date(instantMs), timeZone) === nextDateKey;
  const earliestStart = minBy([firstGuessMs, secondGuessMs].filter(startsNextDate), (ms) => ms);
  return new Date(earliestStart ?? Math.max(firstGuessMs, secondGuessMs));
}

export function millisecondsUntilNextLocalMidnight(now: Date, timeZone: string): number {
  return Math.max(
    MIDNIGHT_GRACE_MS,
    getNextLocalMidnight(now, timeZone).getTime() - now.getTime() + MIDNIGHT_GRACE_MS,
  );
}
