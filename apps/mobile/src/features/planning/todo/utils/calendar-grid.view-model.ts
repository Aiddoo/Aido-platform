import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  diffDateKeysInDays,
  getCalendarWeek,
  getMonthEndDateKey,
  getMonthStartDateKey,
  type DateKey,
} from '@src/shared/date/date-key';
import { range } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { DailyCompletionSummary } from '../domains/daily-completion.model';
import type { CalendarViewMode } from '../schemas/calendar-view-mode-storage.schema';

/** 앱 달력 주(일요일 시작)의 첫날 */
export function getWeekStartKey(dateKey: DateKey): DateKey {
  return getCalendarWeek(dateKey).startDateKey;
}

/** 두 날이 속한 주의 차이 (to - from) */
export function diffCalendarWeeks(from: DateKey, to: DateKey): number {
  return diffDateKeysInDays(getWeekStartKey(from), getWeekStartKey(to)) / DAYS_PER_WEEK;
}

export function getWeekDateKeys(weekStartKey: DateKey): DateKey[] {
  return range(DAYS_PER_WEEK).map((index) => addDaysToDateKey(weekStartKey, index));
}

/** 그 날이 속한 달이 걸친 주의 첫날들. `minWeekCount`보다 적으면 뒤로 주를 더 붙인다 */
export function getMonthWeekStartKeys(dateKey: DateKey, minWeekCount = 0): DateKey[] {
  const firstWeekStartKey = getWeekStartKey(getMonthStartDateKey(dateKey));
  const lastWeekStartKey = getWeekStartKey(getMonthEndDateKey(dateKey));
  const weekCount = diffDateKeysInDays(firstWeekStartKey, lastWeekStartKey) / DAYS_PER_WEEK + 1;

  return range(Math.max(weekCount, minWeekCount)).map((weekIndex) =>
    addDaysToDateKey(firstWeekStartKey, weekIndex * DAYS_PER_WEEK),
  );
}

export interface CalendarDateRange {
  startDate: DateKey;
  endDate: DateKey;
}

/** 그 날이 속한 달을 앞뒤 주까지 채운 달력 범위(일요일 시작) */
function getMonthGridRange(dateKey: DateKey): CalendarDateRange {
  return {
    startDate: getWeekStartKey(getMonthStartDateKey(dateKey)),
    endDate: getCalendarWeek(getMonthEndDateKey(dateKey)).endDateKey,
  };
}

/**
 * 고른 날의 달과 앞 달·다음 달(이웃)의 달력 범위. 주 보기도 같은 달 범위로 받아 달을 넘겨도 키가 같다.
 * 주 보기의 앞뒤 주는 고른 날이 든 달 범위나 그 이웃 달 범위 안에 있다
 */
export function getCalendarMonthRanges(
  dateKey: DateKey,
): Record<'selected' | 'previous' | 'next', CalendarDateRange> {
  const monthStartKey = getMonthStartDateKey(dateKey);
  return {
    selected: getMonthGridRange(monthStartKey),
    previous: getMonthGridRange(addMonthsToDateKey(monthStartKey, -1)),
    next: getMonthGridRange(addMonthsToDateKey(monthStartKey, 1)),
  };
}

export type CompletionsByDate = Record<string, DailyCompletionSummary>;

/** 겹치는 앞뒤 주는 고른 달의 결과로 그린다 */
export function mergeCalendarCompletions({
  selected,
  previous,
  next,
}: Record<'selected' | 'previous' | 'next', CompletionsByDate | undefined>): CompletionsByDate {
  return { ...previous, ...next, ...selected };
}

interface ShiftCalendarDateInput {
  viewMode: CalendarViewMode;
  dateKey: DateKey;
  step: -1 | 1;
}

/** 주 보기는 그 주 일요일에서, 월 보기는 그 달 1일에서 한 칸 옮긴다 */
export function shiftCalendarDateKey({ viewMode, dateKey, step }: ShiftCalendarDateInput): DateKey {
  return match(viewMode)
    .with('week', () => addDaysToDateKey(getWeekStartKey(dateKey), step * DAYS_PER_WEEK))
    .with('month', () => addMonthsToDateKey(getMonthStartDateKey(dateKey), step))
    .exhaustive();
}
