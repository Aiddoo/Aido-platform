import { formatClockTime, type DateFormatContext } from '@src/shared/utils/date-format';
import type { TimeFormat } from '@src/shared/utils/time';

import type { Todo } from '../domains/todo.model';

export function formatTodoTime(
  todo: Todo,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string | null {
  return todo.isAllDay || todo.scheduledAtMs == null
    ? null
    : formatClockTime(new Date(todo.scheduledAtMs), timeFormat, context);
}
