import { DAYS_PER_WEEK } from '@src/shared/constants/time.constants';
import {
  getCalendarWeek,
  type CalendarWeek,
  getDayOfWeek,
  isSameMonthDateKey,
} from '@src/shared/date/date-key';
import { fromDate, type Instant, toDateKey } from '@src/shared/date/instant';
import type { CalendarViewMode } from '@src/shared/preferences/calendar-view-mode.preference';
import dayjs from 'dayjs';
import { range } from 'es-toolkit';
import { match } from 'ts-pattern';

/** 달력 날짜를 가리키는 값. Date는 달력 칸, Instant는 폼에 담긴 값이다 */
type Day = Date | Instant;

const SUNDAY = 0;
const SATURDAY = 6;

function getWeekOfDate(date: Date, timeZone: string): CalendarWeek {
  return getCalendarWeek(toDateKey(date, timeZone));
}

/** 로컬 달력 Date의 앱 달력 주. start는 그 주 일요일 0시, end는 토요일 23:59:59.999. */
export function getCalendarWeekBounds(date: Date, timeZone: string) {
  const week = getWeekOfDate(date, timeZone);
  return {
    start: dayjs(week.startDateKey).toDate(),
    end: dayjs(week.endDateKey).endOf('day').toDate(),
    weekOfMonth: week.weekOfMonth,
  };
}

/** 달력 입력 값을 느슨하게 읽는다. 없거나 읽을 수 없으면 던지지 않고 null이다 */
export function parseInstantOrNull(date?: Date | string | number | null): Instant | null {
  if (date == null) {
    return null;
  }

  const parsed = dayjs(date);
  return parsed.isValid() ? fromDate(parsed.toDate()) : null;
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

export function getWeekStart(date: Date, timeZone: string): Date {
  return getCalendarWeekBounds(date, timeZone).start;
}

/** 두 날짜의 주 단위 차이 (date1 - date2, 앱 달력 주의 시작으로 정규화) */
export function diffWeeks(date1: Date, date2: Date, timeZone: string): number {
  return dayjs(getCalendarWeekBounds(date1, timeZone).start).diff(
    getCalendarWeekBounds(date2, timeZone).start,
    'week',
  );
}

/** 두 날짜의 월 단위 차이 (date1 - date2, startOf('month') 기준으로 정규화) */
export function diffMonths(date1: Date, date2: Date): number {
  return dayjs(date1).startOf('month').diff(dayjs(date2).startOf('month'), 'month');
}

export function getWeekDates(weekStartDate: Date): Date[] {
  return range(DAYS_PER_WEEK).map((index) => dayjs(weekStartDate).add(index, 'day').toDate());
}

export function getMonthWeeks(displayDate: Date, timeZone: string): Date[][] {
  const display = dayjs(displayDate);
  const lastWeekStart = dayjs(
    getCalendarWeekBounds(display.endOf('month').toDate(), timeZone).start,
  );

  const weeks: Date[][] = [];
  let currentWeekStart = dayjs(
    getCalendarWeekBounds(display.startOf('month').toDate(), timeZone).start,
  );

  while (!currentWeekStart.isAfter(lastWeekStart, 'day')) {
    weeks.push(getWeekDates(currentWeekStart.toDate()));
    currentWeekStart = currentWeekStart.add(1, 'week');
  }

  return weeks;
}

/** 캘린더 그리드 범위 (월간 뷰 - 앞뒤 패딩 주 포함) */
export function getCalendarRange(
  displayDate: Date,
  timeZone: string,
): { rangeStart: string; rangeEnd: string } {
  const display = dayjs(displayDate);
  return {
    rangeStart: getWeekOfDate(display.startOf('month').toDate(), timeZone).startDateKey,
    rangeEnd: getWeekOfDate(display.endOf('month').toDate(), timeZone).endDateKey,
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
    .with('week', () => dayjs(getWeekStart(date, timeZone)).add(step, 'week').toDate())
    .with('month', () => dayjs(date).startOf('month').add(step, 'month').toDate())
    .exhaustive();
}
