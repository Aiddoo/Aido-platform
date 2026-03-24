import type { TodoItemResponse } from '@aido/validators';

import type { SubTodo } from '../models/sub-todo.model';

export const toSubTodo = (dto: TodoItemResponse): SubTodo => ({
  id: dto.id,
  title: dto.title,
  completed: dto.completed,
  sortOrder: dto.sortOrder,
});
