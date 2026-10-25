import { formatDateKey } from './date-format';
import { addDaysToDateKey } from './date-key';
import { getDeviceTimezone } from './timezone';

export type LocalDateState = {
  currentLocalDate: Date;
  currentLocalDateKey: string;
  currentTimeZone: string;
  currentUtcOffsetMinutes: number;
};

const MIDNIGHT_GRACE_MS = 100;

const WALL_CLOCK_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
};

export function createLocalDateState(
  now: Date,
  timeZone: string,
  utcOffsetMinutes: number,
): LocalDateState {
  return {
    currentLocalDate: new Date(now),
    currentLocalDateKey: formatDateKey(now, timeZone),
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

function getTimeZoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    ...WALL_CLOCK_FORMAT_OPTIONS,
    timeZone,
  }).formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const wallClockMs = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );
  return wallClockMs - Math.floor(instantMs / 1000) * 1000;
}

/**
 * 지정 시간대에서 다음 날짜가 시작되는 실제 시각.
 *
 * 자정이 없거나(00:00→01:00) 두 번 오는(00:00→23:00) DST 날짜도 있어서
 * 오프셋 후보 두 개 중 다음 날짜 key에 실제로 속하는 가장 이른 시각을 고른다.
 */
export function getNextLocalMidnight(now: Date, timeZone: string): Date {
  const nextDateKey = addDaysToDateKey(formatDateKey(now, timeZone), 1);
  const wallMidnightMs = Date.parse(`${nextDateKey}T00:00:00Z`);
  const firstGuessMs = wallMidnightMs - getTimeZoneOffsetMs(wallMidnightMs, timeZone);
  const secondGuessMs = wallMidnightMs - getTimeZoneOffsetMs(firstGuessMs, timeZone);
  const startsNextDate = (instantMs: number) =>
    instantMs > now.getTime() && formatDateKey(new Date(instantMs), timeZone) === nextDateKey;
  const candidates = [firstGuessMs, secondGuessMs].filter(startsNextDate).sort((a, b) => a - b);
  return new Date(candidates[0] ?? Math.max(firstGuessMs, secondGuessMs));
}

export function millisecondsUntilNextLocalMidnight(now: Date, timeZone: string): number {
  return Math.max(
    MIDNIGHT_GRACE_MS,
    getNextLocalMidnight(now, timeZone).getTime() - now.getTime() + MIDNIGHT_GRACE_MS,
  );
}
