import type { AddTodoFormValues } from '@src/features/planning/composer/domains/add-todo-form.schema';
import { toNullableDate } from '@src/features/planning/todo/utils/calendar-date';
import { toDate } from '@src/shared/date/instant';

import type { TodoRepeat } from '../domains/todo-repeat.model';
import type { Todo } from '../domains/todo.model';

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
