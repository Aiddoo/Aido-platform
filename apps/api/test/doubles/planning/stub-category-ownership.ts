import type { Todo as TodoResponse } from "@aido/api/contracts/todo/v1";

import { todoCategoryNotFound } from "#api/modules/planning/todo-categories/application/todo-categories.errors";
import type { TodoCategoryId } from "#api/modules/planning/todo-categories/domain/todo-category-id.vo";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export function createStubCategoryOwnership(
  categories: Map<number, TodoResponse["category"]>,
  owners: Map<number, string>,
) {
  return {
    async validateOwnership(categoryId: TodoCategoryId, userId: UserId): Promise<void> {
      if (!categories.has(categoryId.value) || owners.get(categoryId.value) !== userId.value) {
        throw todoCategoryNotFound(categoryId);
      }
    },
  };
}
