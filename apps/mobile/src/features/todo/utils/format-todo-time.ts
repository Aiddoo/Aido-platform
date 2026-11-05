import type { DateFormatContext } from '@src/shared/utils/date-format';
import { formatTimeDisplay, type TimeFormat } from '@src/shared/utils/time';

import type { Todo } from '../domains/todo.model';

export function formatTodoTime(
  todo: Todo,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string | null {
  return todo.isAllDay || todo.localTime == null
    ? null
    : formatTimeDisplay(todo.localTime, timeFormat, context);
}
