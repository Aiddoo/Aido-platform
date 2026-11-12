import type {
  CategoryDeletionResult as CategoryDeletionResultDto,
  TodoCategory as TodoCategoryDto,
  TodoCategoryDeletionPreview as TodoCategoryDeletionPreviewDto,
  TodoCategoryWithCount as TodoCategoryWithCountDto,
} from '@aido/api';
import { pick } from 'es-toolkit';

import type {
  TodoCategory,
  TodoCategoryDeletionRequest,
  TodoCategoryDeletionPreview,
  TodoCategoryDeletionResult,
  TodoCategoryWithCount,
} from '../domains/todo-category.model';
import type { TodoCategoryFormValues } from '../schemas/todo-category-form.schema';
import type { TodoCategoryRemoval } from '../schemas/todo-category-request.schema';

export function toTodoCategoryWithCount(dto: TodoCategoryWithCountDto): TodoCategoryWithCount {
  return {
    id: dto.id,
    name: dto.name,
    color: dto.color,
    sortOrder: dto.sortOrder,
    todoCount: dto.todoCount,
  };
}

export function toTodoCategoryWithCounts(
  dtos: TodoCategoryWithCountDto[],
): TodoCategoryWithCount[] {
  return dtos.map(toTodoCategoryWithCount);
}

export function toTodoCategory(dto: TodoCategoryDto): TodoCategory {
  return {
    id: dto.id,
    name: dto.name,
    color: dto.color,
    sortOrder: dto.sortOrder,
  };
}

export function toTodoCategoryDeletionPreview(
  dto: TodoCategoryDeletionPreviewDto,
): TodoCategoryDeletionPreview {
  return pick(dto, ['todoCount', 'completedTodoCount', 'activeSeriesCount', 'isLastCategory']);
}

export function toTodoCategoryDeletionResult(
  dto: CategoryDeletionResultDto,
): TodoCategoryDeletionResult {
  return pick(dto, ['todoHandling', 'todoCount', 'seriesCount', 'moveToCategoryId']);
}

export function toTodoCategoryFormValues(category: TodoCategory): TodoCategoryFormValues {
  return pick(category, ['name', 'color']);
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
