import { DAYS_PER_WEEK } from '@src/shared/constants/time.constants';
import {
  addDaysToDateKey,
  diffDateKeysInDays,
  getCalendarWeek,
  type CalendarWeek,
  getDayOfWeek,
  getMonthEndDateKey,
  isSameMonthDateKey,
} from '@src/shared/date/date-key';
import { fromDate, type Instant, toDate, toDateKey } from '@src/shared/date/instant';
import {
  addLocalDays,
  addLocalMonths,
  addLocalWeeks,
  diffLocalMonths,
  startOfLocalMonth,
  toLocalDay,
} from '@src/shared/date/local-day';
import type { CalendarViewMode } from '@src/shared/preferences/calendar-view-mode.preference';
import { range } from 'es-toolkit';
import { match } from 'ts-pattern';

/** 달력 날짜를 가리키는 값. Date는 달력 칸, Instant는 폼에 담긴 값이다 */
type Day = Date | Instant;

const SUNDAY = 0;
const SATURDAY = 6;

function getWeekOfDate(date: Date, timeZone: string): CalendarWeek {
  return getCalendarWeek(toDateKey(date, timeZone));
}

/** 앱 달력 주의 시작. 그 주 일요일 0시다 */
export function getWeekStart(date: Date, timeZone: string): Date {
  return toLocalDay(getWeekOfDate(date, timeZone).startDateKey);
}

/** 달력 입력 값을 느슨하게 읽는다. 없거나 읽을 수 없으면 던지지 않고 null이다 */
export function parseInstantOrNull(date?: Date | string | number | null): Instant | null {
  if (date == null) {
    return null;
  }

  const parsed = toDate(date);
  return Number.isNaN(parsed.getTime()) ? null : fromDate(parsed);
}

export function isSameDay(date1: Day, date2: Day, timeZone: string): boolean {
  return toDateKey(date1, timeZone) === toDateKey(date2, timeZone);
}

export function isDateToday(date: Day, now: Day, timeZone: string): boolean {
  return isSameDay(date, now, timeZone);
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

export function isSunday(date: Day, timeZone: string): boolean {
  return getDayOfWeek(toDateKey(date, timeZone)) === SUNDAY;
}

export function isSaturday(date: Day, timeZone: string): boolean {
  return getDayOfWeek(toDateKey(date, timeZone)) === SATURDAY;
}

/** 두 날짜의 주 단위 차이 (date1 - date2, 앱 달력 주의 시작으로 정규화) */
export function diffWeeks(date1: Date, date2: Date, timeZone: string): number {
  const days = diffDateKeysInDays(
    getWeekOfDate(date2, timeZone).startDateKey,
    getWeekOfDate(date1, timeZone).startDateKey,
  );

  return days / DAYS_PER_WEEK;
}

/** 두 날짜의 월 단위 차이 (date1 - date2) */
export function diffMonths(date1: Date, date2: Date, timeZone: string): number {
  return diffLocalMonths(date1, date2, timeZone);
}

export function getWeekDates(weekStartDate: Date, timeZone: string): Date[] {
  return range(DAYS_PER_WEEK).map((index) => addLocalDays(weekStartDate, index, timeZone));
}

export function getMonthWeeks(displayDate: Date, timeZone: string): Date[][] {
  const monthStart = startOfLocalMonth(displayDate, timeZone);
  const monthStartKey = toDateKey(monthStart, timeZone);
  const lastWeekStartKey = getCalendarWeek(getMonthEndDateKey(monthStartKey)).startDateKey;

  const weeks: Date[][] = [];
  let currentWeekStartKey = getCalendarWeek(monthStartKey).startDateKey;

  while (currentWeekStartKey <= lastWeekStartKey) {
    weeks.push(getWeekDates(toLocalDay(currentWeekStartKey), timeZone));
    currentWeekStartKey = addDaysToDateKey(currentWeekStartKey, DAYS_PER_WEEK);
  }

  return weeks;
}

/** 캘린더 그리드 범위 (월간 뷰 - 앞뒤 패딩 주 포함) */
export function getCalendarRange(
  displayDate: Date,
  timeZone: string,
): { rangeStart: string; rangeEnd: string } {
  const monthStartKey = toDateKey(startOfLocalMonth(displayDate, timeZone), timeZone);

  return {
    rangeStart: getCalendarWeek(monthStartKey).startDateKey,
    rangeEnd: getCalendarWeek(getMonthEndDateKey(monthStartKey)).endDateKey,
  };
}

export function getWeekRange(
  displayDate: Date,
  timeZone: string,
): { rangeStart: string; rangeEnd: string } {
  const week = getWeekOfDate(displayDate, timeZone);
  return { rangeStart: week.startDateKey, rangeEnd: week.endDateKey };
}

export function shiftCalendarDate(
  viewMode: CalendarViewMode,
  date: Date,
  step: -1 | 1,
  timeZone: string,
): Date {
  return match(viewMode)
    .with('week', () => addLocalWeeks(getWeekStart(date, timeZone), step, timeZone))
    .with('month', () => addLocalMonths(startOfLocalMonth(date, timeZone), step, timeZone))
    .exhaustive();
}
