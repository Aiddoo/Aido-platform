import type { TodoItemResponse } from '@aido/api/contracts/todo/v1';

import type { SubTodo } from '../domains/sub-todo.model';

export function toSubTodo(dto: TodoItemResponse): SubTodo {
  return {
    id: dto.id,
    title: dto.title,
    completed: dto.completed,
    sortOrder: dto.sortOrder,
  };
}
