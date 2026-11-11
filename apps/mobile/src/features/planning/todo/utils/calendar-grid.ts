import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  diffDateKeysInDays,
  getCalendarWeek,
  getMonthEndDateKey,
  getMonthStartDateKey,
} from '@src/shared/date/date-key';
import { range } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { CalendarViewMode } from '../schemas/calendar-view-mode-storage.schema';

/** 앱 달력 주(일요일 시작)의 첫날 */
export function getWeekStartKey(dateKey: string): string {
  return getCalendarWeek(dateKey).startDateKey;
}

/** 두 날이 속한 주의 차이 (to - from) */
export function diffCalendarWeeks(from: string, to: string): number {
  return diffDateKeysInDays(getWeekStartKey(from), getWeekStartKey(to)) / DAYS_PER_WEEK;
}

export function getWeekDateKeys(weekStartKey: string): string[] {
  return range(DAYS_PER_WEEK).map((index) => addDaysToDateKey(weekStartKey, index));
}

/** 그 날이 속한 달이 걸친 주의 첫날들. `minWeekCount`보다 적으면 뒤로 주를 더 붙인다 */
export function getMonthWeekStartKeys(dateKey: string, minWeekCount = 0): string[] {
  const firstWeekStartKey = getWeekStartKey(getMonthStartDateKey(dateKey));
  const lastWeekStartKey = getWeekStartKey(getMonthEndDateKey(dateKey));
  const weekCount = diffDateKeysInDays(firstWeekStartKey, lastWeekStartKey) / DAYS_PER_WEEK + 1;

  return range(Math.max(weekCount, minWeekCount)).map((weekIndex) =>
    addDaysToDateKey(firstWeekStartKey, weekIndex * DAYS_PER_WEEK),
  );
}

export interface CalendarDateRange {
  startDate: string;
  endDate: string;
}

/** 그 날이 속한 달을 앞뒤 주까지 채운 달력 범위(일요일 시작) */
function getMonthGridRange(dateKey: string): CalendarDateRange {
  return {
    startDate: getWeekStartKey(getMonthStartDateKey(dateKey)),
    endDate: getCalendarWeek(getMonthEndDateKey(dateKey)).endDateKey,
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
  dateKey: string;
  step: -1 | 1;
}

/** 주 보기는 그 주 일요일에서, 월 보기는 그 달 1일에서 한 칸 옮긴다 */
export function shiftCalendarDateKey({ viewMode, dateKey, step }: ShiftCalendarDateInput): string {
  return match(viewMode)
    .with('week', () => addDaysToDateKey(getWeekStartKey(dateKey), step * DAYS_PER_WEEK))
    .with('month', () => addMonthsToDateKey(getMonthStartDateKey(dateKey), step))
    .exhaustive();
}
