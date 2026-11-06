import {
  formatTimeDisplay,
  type DateFormatContext,
  type TimeFormat,
} from '@src/shared/date/date-format';

import type { Todo } from '../schemas/todo.schema';

export function formatTodoTime(
  todo: Todo,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string | null {
  return todo.isAllDay || todo.localTime == null
    ? null
    : formatTimeDisplay(todo.localTime, timeFormat, context);
}
