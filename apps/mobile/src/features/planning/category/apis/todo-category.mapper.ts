import type {
  TodoCategory as TodoCategoryDTO,
  TodoCategoryWithCount as TodoCategoryWithCountDTO,
} from '@aido/api';

import type { TodoCategory, TodoCategoryWithCount } from '../schemas/todo-category.schema';

export function toTodoCategoryWithCount(dto: TodoCategoryWithCountDTO): TodoCategoryWithCount {
  return {
    id: dto.id,
    name: dto.name,
    color: dto.color,
    sortOrder: dto.sortOrder,
    todoCount: dto.todoCount,
  };
}

export function toTodoCategoryWithCounts(
  dtos: TodoCategoryWithCountDTO[],
): TodoCategoryWithCount[] {
  return dtos.map(toTodoCategoryWithCount);
}

export function toTodoCategory(dto: TodoCategoryDTO): TodoCategory {
  return {
    id: dto.id,
    name: dto.name,
    color: dto.color,
    sortOrder: dto.sortOrder,
  };
}
