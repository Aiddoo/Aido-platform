import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  getCalendarWeek,
  getMonthStartDateKey,
  type DateKey,
} from '@src/shared/date/date-key';
import { match } from 'ts-pattern';

import {
  type DailyCompletionRange,
  getCompletionMonthRange,
} from '../domains/daily-completion.model';
import type { CalendarViewMode } from '../schemas/calendar-view-mode-storage.schema';

/**
 * 고른 날의 달과 앞 달·다음 달(이웃)의 1일. 주 보기도 같은 달로 받아 달을 넘겨도 키가 같다.
 * 주 보기의 앞뒤 주는 고른 날이 든 달 칸이나 그 이웃 달 칸 안에 있다
 */
export function getCalendarMonths(
  dateKey: DateKey,
): Record<'selected' | 'previous' | 'next', DateKey> {
  const monthStartKey = getMonthStartDateKey(dateKey);
  return {
    selected: monthStartKey,
    previous: addMonthsToDateKey(monthStartKey, -1),
    next: addMonthsToDateKey(monthStartKey, 1),
  };
}

/** 이웃 달까지 그 달을 앞뒤 주로 채운 달력 칸 범위(일요일 시작) */
export function getCalendarMonthRanges(
  dateKey: DateKey,
): Record<'selected' | 'previous' | 'next', DailyCompletionRange> {
  const { selected, previous, next } = getCalendarMonths(dateKey);
  return {
    selected: getCompletionMonthRange(selected),
    previous: getCompletionMonthRange(previous),
    next: getCompletionMonthRange(next),
  };
}

interface ShiftCalendarDateInput {
  viewMode: CalendarViewMode;
  dateKey: DateKey;
  step: -1 | 1;
}

/** 주 보기는 그 주 일요일에서, 월 보기는 그 달 1일에서 한 칸 옮긴다 */
export function shiftCalendarDateKey({ viewMode, dateKey, step }: ShiftCalendarDateInput): DateKey {
  return match(viewMode)
    .with('week', () =>
      addDaysToDateKey(getCalendarWeek(dateKey).startDateKey, step * DAYS_PER_WEEK),
    )
    .with('month', () => addMonthsToDateKey(getMonthStartDateKey(dateKey), step))
    .exhaustive();
}
