import { isSameMonthDateKey } from '@src/shared/date/date-key';
import { type Instant } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';

/** 달력 날짜를 가리키는 값. Date는 달력 칸, Instant는 폼에 담긴 값이다 */
type Day = Date | Instant;

export function isSameDay(date1: Day, date2: Day, timeZone: string): boolean {
  return toDateKey(date1, timeZone) === toDateKey(date2, timeZone);
}

export function isSameMonth(date1: Day, date2: Day, timeZone: string): boolean {
  return isSameMonthDateKey(toDateKey(date1, timeZone), toDateKey(date2, timeZone));
}

export function isAfterDay(date1: Day, date2: Day, timeZone: string): boolean {
  return toDateKey(date1, timeZone) > toDateKey(date2, timeZone);
}

export function isBeforeDay(date1: Day, date2: Day, timeZone: string): boolean {
  return toDateKey(date1, timeZone) < toDateKey(date2, timeZone);
}
