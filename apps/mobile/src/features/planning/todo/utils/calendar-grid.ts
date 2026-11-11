import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  diffDateKeysInDays,
  getCalendarWeek,
  type CalendarWeek,
  getMonthEndDateKey,
  getMonthStartDateKey,
} from '@src/shared/date/date-key';
import { toLocalDay } from '@src/shared/date/native-date';
import { addLocalDays, addLocalMonths, startOfLocalMonth, toDateKey } from '@src/shared/date/zoned';
import { range } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { CalendarViewMode } from '../schemas/calendar-view-mode-storage.schema';

function getWeekOfDate(date: Date, timeZone: string): CalendarWeek {
  return getCalendarWeek(toDateKey(date, timeZone));
}

/** 앱 달력 주의 시작. 그 주 일요일 0시다 */
export function getWeekStart(date: Date, timeZone: string): Date {
  return toLocalDay(getWeekOfDate(date, timeZone).startDateKey);
}

/** 두 날짜의 주 단위 차이 (date1 - date2, 앱 달력 주의 시작으로 정규화) */
export function diffWeeks(date1: Date, date2: Date, timeZone: string): number {
  const days = diffDateKeysInDays(
    getWeekOfDate(date2, timeZone).startDateKey,
    getWeekOfDate(date1, timeZone).startDateKey,
  );

  return days / DAYS_PER_WEEK;
}

export function getWeekDates(weekStartDate: Date, timeZone: string): Date[] {
  return range(DAYS_PER_WEEK).map((index) => addLocalDays(weekStartDate, index, timeZone));
}

export function getMonthWeeks(displayDate: Date, timeZone: string): Date[][] {
  const monthStart = startOfLocalMonth(displayDate, timeZone);
  const monthStartKey = toDateKey(monthStart, timeZone);
  const lastWeekStartKey = getCalendarWeek(getMonthEndDateKey(monthStartKey)).startDateKey;

  const firstWeekStartKey = getCalendarWeek(monthStartKey).startDateKey;
  const weekCount = diffDateKeysInDays(firstWeekStartKey, lastWeekStartKey) / DAYS_PER_WEEK + 1;

  return range(weekCount).map((weekIndex) =>
    getWeekDates(
      toLocalDay(addDaysToDateKey(firstWeekStartKey, weekIndex * DAYS_PER_WEEK)),
      timeZone,
    ),
  );
}

export interface CalendarDateRange {
  startDate: string;
  endDate: string;
}

/** 그 날이 속한 달을 앞뒤 주까지 채운 달력 범위(일요일 시작) */
function getMonthGridRange(dateKey: string): CalendarDateRange {
  const monthStartKey = getMonthStartDateKey(dateKey);
  return {
    startDate: getCalendarWeek(monthStartKey).startDateKey,
    endDate: getCalendarWeek(getMonthEndDateKey(monthStartKey)).endDateKey,
  };
}

/**
 * 고른 날의 달과 앞 달·다음 달(이웃)의 달력 범위. 주 보기도 같은 달 범위로 받아 달을 넘겨도 키가 같다.
 * 주 보기의 앞뒤 주는 고른 날이 든 달 범위나 그 이웃 달 범위 안에 있다
 */
export function getCalendarMonthRanges(dateKey: string): {
  selected: CalendarDateRange;
  neighbors: CalendarDateRange[];
} {
  const monthStartKey = getMonthStartDateKey(dateKey);
  return {
    selected: getMonthGridRange(monthStartKey),
    neighbors: [-1, 1].map((offset) =>
      getMonthGridRange(addMonthsToDateKey(monthStartKey, offset)),
    ),
  };
}

interface ShiftCalendarDateInput {
  viewMode: CalendarViewMode;
  date: Date;
  step: -1 | 1;
  timeZone: string;
}

export function shiftCalendarDate({
  viewMode,
  date,
  step,
  timeZone,
}: ShiftCalendarDateInput): Date {
  return match(viewMode)
    .with('week', () => addLocalDays(getWeekStart(date, timeZone), step * DAYS_PER_WEEK, timeZone))
    .with('month', () => addLocalMonths(startOfLocalMonth(date, timeZone), step, timeZone))
    .exhaustive();
}
