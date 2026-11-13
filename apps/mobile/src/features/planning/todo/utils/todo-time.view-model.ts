import {
  formatHHmmTime,
  type DateFormatContext,
  type TimeFormat,
} from '@src/shared/date/format/date-format';

import { type Todo, TodoPolicy } from '../domains/todo.model';

export function formatTodoTime(
  todo: Todo,
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string | null {
  const localTime = TodoPolicy.getLocalTime(todo, context.timeZone);
  return localTime == null ? null : formatHHmmTime(localTime, timeFormat, context);
}
