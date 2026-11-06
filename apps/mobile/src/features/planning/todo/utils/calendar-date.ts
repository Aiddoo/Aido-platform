import { DAYS_PER_WEEK } from '@src/shared/constants/time.constants';
import { getCalendarWeek, type CalendarWeek, getDayOfWeek } from '@src/shared/date/date-key';
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
  return toDeviceDateKey(date1).slice(0, 7) === toDeviceDateKey(date2).slice(0, 7);
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

export function startOfDay(date: Date): Date {
  return dayjs(date).startOf('day').toDate();
}

export function getMonthStart(date: Date): Date {
  return dayjs(date).startOf('month').toDate();
}

export function getNextDay(date: Date): Date {
  return dayjs(date).add(1, 'day').toDate();
}

export function getPreviousMonth(date: Date): Date {
  return dayjs(date).subtract(1, 'month').toDate();
}

export function getNextMonth(date: Date): Date {
  return dayjs(date).add(1, 'month').toDate();
}

export function addWeeks(date: Date, weeks: number): Date {
  return dayjs(date).add(weeks, 'week').toDate();
}

export function addMonths(date: Date, months: number): Date {
  return dayjs(date).add(months, 'month').toDate();
}

/** 두 날짜의 주 단위 차이 (date1 - date2, 앱 달력 주의 시작으로 정규화) */
export function diffWeeks(date1: Date, date2: Date): number {
  return dayjs(getCalendarWeekBounds(date1).start).diff(getCalendarWeekBounds(date2).start, 'week');
}

/** 두 날짜의 월 단위 차이 (date1 - date2, startOf('month') 기준으로 정규화) */
export function diffMonths(date1: Date, date2: Date): number {
  return dayjs(date1).startOf('month').diff(dayjs(date2).startOf('month'), 'month');
}

/** 그 주 안에서 요일을 n번째로 이동 (0=일, 6=토) */
export function withDayOfWeek(date: Date, dayOfWeek: number): Date {
  return dayjs(date).day(dayOfWeek).toDate();
}

/** 그 달 안에서 날짜를 n일로 이동 (월말이면 자동 clamp, 예: 1/31 → 2월은 2/28) */
export function withDayOfMonth(date: Date, dayOfMonth: number): Date {
  return dayjs(date).date(dayOfMonth).toDate();
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
