import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import type { TodoRepeat } from '@src/features/planning/todo/schemas/todo-repeat.schema';
import type { Todo } from '@src/features/planning/todo/schemas/todo.schema';
import { toNullableDate } from '@src/features/planning/todo/utils/calendar-date';
import { toDate } from '@src/shared/date/instant';

import type { AddTodoFormValues } from '../schemas/add-todo-form.schema';

export function toTodoEditFormValues(
  todo: Todo,
  timeZone: string,
  repeat: TodoRepeat | null = todo.repeat,
): AddTodoFormValues {
  return {
    title: todo.title,
    startDate: toDate(todo.startDate),
    endDate: toNullableDate(todo.endDate),
    scheduledTime: TodoPolicy.getLocalTime(todo, timeZone),
    isAllDay: todo.isAllDay,
    categoryId: todo.category.id,
    visibility: todo.visibility,
    repeat,
  };
}
