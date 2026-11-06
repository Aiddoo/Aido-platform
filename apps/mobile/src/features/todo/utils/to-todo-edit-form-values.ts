import { toDate, toNullableDate } from '@src/shared/utils/date';

import type { AddTodoFormValues } from '../domains/add-todo-form.schema';
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
