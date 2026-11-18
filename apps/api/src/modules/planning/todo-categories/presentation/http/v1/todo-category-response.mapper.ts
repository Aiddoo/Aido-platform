import type {
  CategoryDeletionResult,
  TodoCategory as TodoCategoryDto,
  TodoCategoryDeletionPreview,
  TodoCategoryWithCount as TodoCategoryWithCountDto,
} from "@aido/api/contracts/todo-category/v1";

import { toIsoString } from "#api/shared/domain/time/instant";

import type {
  TodoCategoryDeletionPreviewReadModel,
  TodoCategoryDeletionReadModel,
} from "../../../application/read-models/todo-category-deletion.read-model.js";
import type { TodoCategoryWithCountReadModel } from "../../../application/read-models/todo-category-with-count.read-model.js";
import type { TodoCategory } from "../../../domain/todo-category.aggregate.js";

export function toTodoCategoryResponse(category: TodoCategory): TodoCategoryDto {
  const { id, userId, name, color, sortOrder, createdAt, updatedAt } = category.toPrimitives();
  return {
    id,
    userId,
    name,
    color,
    sortOrder,
    createdAt: toIsoString(createdAt),
    updatedAt: toIsoString(updatedAt),
  };
}

export function toTodoCategoryWithCountResponse(
  category: TodoCategoryWithCountReadModel,
): TodoCategoryWithCountDto {
  return {
    id: category.id,
    userId: category.userId,
    name: category.name,
    color: category.color,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    todoCount: category.todoCount,
  };
}

export function toTodoCategoryDeletionPreviewResponse(
  preview: TodoCategoryDeletionPreviewReadModel,
): TodoCategoryDeletionPreview {
  return {
    categoryId: preview.categoryId,
    todoCount: preview.todoCount,
    completedTodoCount: preview.completedTodoCount,
    activeSeriesCount: preview.activeSeriesCount,
    isLastCategory: preview.isLastCategory,
  };
}

export function toTodoCategoryDeletionResponse(
  deletion: TodoCategoryDeletionReadModel,
): CategoryDeletionResult {
  return {
    todoHandling: deletion.todoHandling,
    todoCount: deletion.todoCount,
    seriesCount: deletion.seriesCount,
    moveToCategoryId: deletion.moveToCategoryId,
  };
}
