import { DAYS_PER_WEEK } from '@src/shared/constants/time.constants';
import {
  getCalendarWeek,
  type CalendarWeek,
  getDayOfWeek,
  isSameMonthDateKey,
} from '@src/shared/date/date-key';
import { toDateKey } from '@src/shared/date/instant';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
import dayjs from 'dayjs';
import { range } from 'es-toolkit';

const SUNDAY = 0;
const SATURDAY = 6;

function toDeviceDateKey(date: Date): string {
  return toDateKey(date, getDeviceTimezone());
}

function getWeekOfDate(date: Date): CalendarWeek {
  return getCalendarWeek(toDeviceDateKey(date));
}

/** 로컬 달력 Date의 앱 달력 주. start는 그 주 일요일 0시, end는 토요일 23:59:59.999. */
export function getCalendarWeekBounds(date: Date) {
  const week = getWeekOfDate(date);
  return {
    start: dayjs(week.startDateKey).toDate(),
    end: dayjs(week.endDateKey).endOf('day').toDate(),
    weekOfMonth: week.weekOfMonth,
  };
}

export function toNullableDate(date?: Date | string | number | null): Date | null {
  if (date == null) {
    return null;
  }

  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.toDate() : null;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return toDeviceDateKey(date1) === toDeviceDateKey(date2);
}

export function isDateToday(date: Date, now: Date): boolean {
  return isSameDay(date, now);
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return isSameMonthDateKey(toDeviceDateKey(date1), toDeviceDateKey(date2));
}

export function isAfterDay(date1: Date, date2: Date): boolean {
  return toDeviceDateKey(date1) > toDeviceDateKey(date2);
}

export function isBeforeDay(date1: Date, date2: Date): boolean {
  return toDeviceDateKey(date1) < toDeviceDateKey(date2);
}

export function isSunday(date: Date): boolean {
  return getDayOfWeek(toDeviceDateKey(date)) === SUNDAY;
}

export function isSaturday(date: Date): boolean {
  return getDayOfWeek(toDeviceDateKey(date)) === SATURDAY;
}

export function getWeekStart(date: Date): Date {
  return getCalendarWeekBounds(date).start;
}

/** 두 날짜의 주 단위 차이 (date1 - date2, 앱 달력 주의 시작으로 정규화) */
export function diffWeeks(date1: Date, date2: Date): number {
  return dayjs(getCalendarWeekBounds(date1).start).diff(getCalendarWeekBounds(date2).start, 'week');
}

/** 두 날짜의 월 단위 차이 (date1 - date2, startOf('month') 기준으로 정규화) */
export function diffMonths(date1: Date, date2: Date): number {
  return dayjs(date1).startOf('month').diff(dayjs(date2).startOf('month'), 'month');
}

export function getWeekDates(weekStartDate: Date): Date[] {
  return range(DAYS_PER_WEEK).map((index) => dayjs(weekStartDate).add(index, 'day').toDate());
}

export function getMonthWeeks(displayDate: Date): Date[][] {
  const display = dayjs(displayDate);
  const lastWeekStart = dayjs(getCalendarWeekBounds(display.endOf('month').toDate()).start);

  const weeks: Date[][] = [];
  let currentWeekStart = dayjs(getCalendarWeekBounds(display.startOf('month').toDate()).start);

  while (!currentWeekStart.isAfter(lastWeekStart, 'day')) {
    weeks.push(getWeekDates(currentWeekStart.toDate()));
    currentWeekStart = currentWeekStart.add(1, 'week');
  }

  return weeks;
}

/** 캘린더 그리드 범위 (월간 뷰 - 앞뒤 패딩 주 포함) */
export function getCalendarRange(displayDate: Date): { rangeStart: string; rangeEnd: string } {
  const display = dayjs(displayDate);
  return {
    rangeStart: getWeekOfDate(display.startOf('month').toDate()).startDateKey,
    rangeEnd: getWeekOfDate(display.endOf('month').toDate()).endDateKey,
  };
}

export function getWeekRange(displayDate: Date): { rangeStart: string; rangeEnd: string } {
  const week = getWeekOfDate(displayDate);
  return { rangeStart: week.startDateKey, rangeEnd: week.endDateKey };
}
