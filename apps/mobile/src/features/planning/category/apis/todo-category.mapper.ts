import type {
  CategoryDeletionResult as CategoryDeletionResultDTO,
  TodoCategory as TodoCategoryDTO,
  TodoCategoryDeletionPreview as TodoCategoryDeletionPreviewDTO,
  TodoCategoryWithCount as TodoCategoryWithCountDTO,
} from '@aido/api';
import { pick } from 'es-toolkit';

import type {
  TodoCategory,
  TodoCategoryDeletionRequest,
  TodoCategoryDeletionPreview,
  TodoCategoryDeletionResult,
  TodoCategoryWithCount,
} from '../domains/todo-category.model';
import type { TodoCategoryRemoval } from '../schemas/todo-category-request.schema';

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

export function toTodoCategoryDeletionPreview(
  dto: TodoCategoryDeletionPreviewDTO,
): TodoCategoryDeletionPreview {
  return pick(dto, ['todoCount', 'completedTodoCount', 'activeSeriesCount', 'isLastCategory']);
}

export function toTodoCategoryDeletionResult(
  dto: CategoryDeletionResultDTO,
): TodoCategoryDeletionResult {
  return pick(dto, ['todoHandling', 'todoCount', 'seriesCount', 'moveToCategoryId']);
}

/** 처리 방식을 생략하면 서버는 출시 앱의 규칙(할 일이 있으면 옮길 곳 필수)으로 지운다 */
export function toTodoCategoryRemoval({
  todoHandling,
  moveToCategoryId,
}: TodoCategoryDeletionRequest): TodoCategoryRemoval {
  return {
    ...(todoHandling != null && { todoHandling }),
    ...(moveToCategoryId != null && { moveToCategoryId }),
  };
}
