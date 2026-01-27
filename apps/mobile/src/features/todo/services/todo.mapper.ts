import type { Todo } from '@aido/validators';

import type { TodoItem } from '../models/todo.model';

export const toTodoItem = (dto: Todo): TodoItem => ({
  id: dto.id,
  title: dto.title,
  color: dto.color,
  completed: dto.completed,
  scheduledTime: dto.scheduledTime ? new Date(dto.scheduledTime) : null,
  isAllDay: dto.isAllDay,
  visibility: dto.visibility,
});

export const toTodoItems = (dtos: Todo[]): TodoItem[] => dtos.map(toTodoItem);
