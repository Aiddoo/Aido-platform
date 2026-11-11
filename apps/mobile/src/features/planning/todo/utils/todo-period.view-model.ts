import {
  type DateFormatContext,
  formatDateKeyCompactRange,
  formatYearAwareDateKeyLabel,
} from '@src/shared/date/format/date-format';

import type { Todo } from '../domains/todo.model';

/** 할 일 기간 한 줄. 하루면 날짜 하나, 여러 날이면 짧은 범위(10월 2일~5일)다 */
export function formatTodoPeriod(
  { startDate, endDate }: Pick<Todo, 'startDate' | 'endDate'>,
  todayKey: string,
  context: DateFormatContext,
): string {
  return endDate == null || endDate === startDate
    ? formatYearAwareDateKeyLabel(startDate, todayKey, context)
    : formatDateKeyCompactRange(startDate, endDate, todayKey, context);
}
