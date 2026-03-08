import type {
  TodoCategory as TodoCategoryDTO,
  TodoCategoryWithCount as TodoCategoryWithCountDTO,
} from '@aido/validators';

import type { TodoCategory, TodoCategoryWithCount } from '../models/todo-category.model';

/** TodoCategoryWithCount DTO → TodoCategoryWithCount 도메인 모델 (목록 조회용) */
export const toTodoCategoryWithCount = (dto: TodoCategoryWithCountDTO): TodoCategoryWithCount => ({
  id: dto.id,
  name: dto.name,
  color: dto.color,
  sortOrder: dto.sortOrder,
  todoCount: dto.todoCount,
});

export const toTodoCategoryWithCounts = (
  dtos: TodoCategoryWithCountDTO[],
): TodoCategoryWithCount[] => dtos.map(toTodoCategoryWithCount);

/** TodoCategory DTO → TodoCategory 도메인 모델 (생성/수정 응답용) */
export const toTodoCategory = (dto: TodoCategoryDTO): TodoCategory => ({
  id: dto.id,
  name: dto.name,
  color: dto.color,
  sortOrder: dto.sortOrder,
});
