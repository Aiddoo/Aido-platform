import type { TodoRepeat } from '@src/features/planning/todo/domains/todo-repeat.model';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { toNullableDate } from '@src/features/planning/todo/utils/calendar-date';
import { toDate } from '@src/shared/date/instant';

import type { AddTodoFormValues } from '../schemas/add-todo-form.schema';

export function toTodoEditFormValues(
  todo: Todo,
  repeat: TodoRepeat | null = todo.repeat,
): AddTodoFormValues {
  return {
    title: todo.title,
    startDate: toDate(todo.startDate),
    endDate: toNullableDate(todo.endDate),
    scheduledTime: todo.isAllDay ? null : todo.localTime,
    isAllDay: todo.isAllDay,
    categoryId: todo.category.id,
    visibility: todo.visibility,
    repeat,
  };
}
