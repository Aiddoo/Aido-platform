import { toDate, toNullableDate } from '@src/shared/utils/date';

import type { AddTodoFormInput } from '../domains/add-todo-form.schema';
import type { TodoRepeat } from '../domains/todo-repeat.model';
import type { Todo } from '../domains/todo.model';

export function toTodoEditFormValues(
  todo: Todo,
  repeat: TodoRepeat | null = todo.repeat,
): AddTodoFormInput {
  return {
    title: todo.title,
    startDate: toDate(todo.startDate),
    endDate: toNullableDate(todo.endDate),
    scheduledTime: todo.isAllDay ? undefined : (todo.localTime ?? undefined),
    isAllDay: todo.isAllDay,
    categoryId: todo.category.id,
    visibility: todo.visibility,
    repeat,
    source: 'manual',
  };
}
