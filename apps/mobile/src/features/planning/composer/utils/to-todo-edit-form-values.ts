import type { TodoRepeat } from '@src/features/planning/todo/schemas/todo-repeat.schema';
import type { Todo } from '@src/features/planning/todo/schemas/todo.schema';
import { toTodoScheduleValues } from '@src/features/planning/todo/utils/todo-schedule-values';

import type { AddTodoFormValues } from '../schemas/add-todo-form.schema';

export function toTodoEditFormValues(
  todo: Todo,
  timeZone: string,
  repeat: TodoRepeat | null = todo.repeat,
): AddTodoFormValues {
  return {
    title: todo.title,
    ...toTodoScheduleValues(todo, timeZone),
    isAllDay: todo.isAllDay,
    categoryId: todo.category.id,
    visibility: todo.visibility,
    repeat,
  };
}
