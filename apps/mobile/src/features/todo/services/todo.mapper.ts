import type { AiUsageResponse, ParseTodoResponse, Todo } from '@aido/validators';

import type { AiUsage, ParsedTodoResult, TodoItem } from '../models/todo.model';

export const toTodoItem = (dto: Todo): TodoItem => ({
  id: dto.id,
  title: dto.title,
  category: dto.category,
  completed: dto.completed,
  scheduledTime: dto.scheduledTime ? new Date(dto.scheduledTime) : null,
  isAllDay: dto.isAllDay,
  visibility: dto.visibility,
});

export const toTodoItems = (dtos: Todo[]): TodoItem[] => dtos.map(toTodoItem);

export const toParsedTodoResult = (dto: ParseTodoResponse): ParsedTodoResult => ({
  data: dto.data,
  meta: dto.meta,
});

export const toAiUsage = (dto: AiUsageResponse): AiUsage => dto.data;
