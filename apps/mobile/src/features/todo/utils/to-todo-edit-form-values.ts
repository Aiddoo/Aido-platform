import { toDate, toNullableDate } from '@src/shared/utils/date';
import { toHHmm } from '@src/shared/utils/time';

import type { AddTodoFormInput } from '../domains/add-todo-form.schema';
import type { Todo } from '../domains/todo.model';

export function toTodoEditFormValues(todo: Todo): AddTodoFormInput {
  return {
    title: todo.title,
    startDate: toDate(todo.startDate),
    endDate: toNullableDate(todo.endDate),
    scheduledTime:
      todo.isAllDay || todo.scheduledAtMs == null
        ? undefined
        : toHHmm(new Date(todo.scheduledAtMs)),
    isAllDay: todo.isAllDay,
    categoryId: todo.category.id,
    visibility: todo.visibility,
    isRecurring: false,
    repeatEndDate: null,
    daysOfWeek: [],
    source: 'manual',
  };
}
