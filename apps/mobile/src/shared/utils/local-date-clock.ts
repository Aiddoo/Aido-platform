import { formatDateKey } from './date-format';

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
    currentLocalDateKey: formatDateKey(now, timeZone),
    currentTimeZone: timeZone,
    currentUtcOffsetMinutes: utcOffsetMinutes,
  };
}

export function isSameLocalDateState(previous: LocalDateState, next: LocalDateState): boolean {
  return (
    previous.currentLocalDateKey === next.currentLocalDateKey &&
    previous.currentTimeZone === next.currentTimeZone &&
    previous.currentUtcOffsetMinutes === next.currentUtcOffsetMinutes
  );
}

export function millisecondsUntilNextLocalMidnight(now: Date): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(MIDNIGHT_GRACE_MS, nextMidnight.getTime() - now.getTime() + MIDNIGHT_GRACE_MS);
}
