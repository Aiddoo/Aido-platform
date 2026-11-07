import type {
  TodoCategory as TodoCategoryDTO,
  TodoCategoryWithCount as TodoCategoryWithCountDTO,
} from '@aido/api';

import type { TodoCategory, TodoCategoryWithCount } from '../schemas/todo-category.schema';

/** TodoCategoryWithCount DTO → TodoCategoryWithCount 도메인 모델 (목록 조회용) */
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

/** TodoCategory DTO → TodoCategory 도메인 모델 (생성/수정 응답용) */
export function toTodoCategory(dto: TodoCategoryDTO): TodoCategory {
  return {
    id: dto.id,
    name: dto.name,
    color: dto.color,
    sortOrder: dto.sortOrder,
  };
}
