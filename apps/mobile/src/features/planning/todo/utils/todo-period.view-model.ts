import type { DateKey } from '@src/shared/date/date-key';
import {
  type DateFormatContext,
  formatYearAwareDateKeyLabel,
} from '@src/shared/date/format/date-format';
import {
  formatDateKeyCompactRange,
  formatRelativeDayLabel,
} from '@src/shared/date/format/date-labels';

import type { Todo } from '../domains/todo.model';

/** 할 일 기간 한 줄. 하루면 오늘·내일 또는 날짜 하나, 여러 날이면 짧은 범위(10월 2일~5일)다 */
export function formatTodoPeriod(
  { startDate, endDate }: Pick<Todo, 'startDate' | 'endDate'>,
  todayKey: DateKey,
  context: DateFormatContext,
): string {
  if (endDate != null && endDate !== startDate) {
    return formatDateKeyCompactRange(startDate, endDate, todayKey, context);
  }
  return (
    formatRelativeDayLabel(startDate, todayKey, context) ??
    formatYearAwareDateKeyLabel(startDate, todayKey, context)
  );
}
