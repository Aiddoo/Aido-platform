import { addMonths, addWeeks, getMonthStart, getWeekStart } from '@src/shared/utils/date';
import { match } from 'ts-pattern';

import type { CalendarViewMode } from '../../components/calendar/calendar.types';

export function shiftCalendarDate(viewMode: CalendarViewMode, date: Date, step: -1 | 1): Date {
  return match(viewMode)
    .with('week', () => addWeeks(getWeekStart(date), step))
    .with('month', () => addMonths(getMonthStart(date), step))
    .exhaustive();
}

export function clampCalendarPage(page: number, totalPages: number): number {
  return Math.max(0, Math.min(totalPages - 1, page));
}
