import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

export function createStubCategoryOwnership(
  categories: Map<number, TodoResponse["category"]>,
  owners: Map<number, string>,
) {
  return {
    async validateOwnership(categoryId: number, userId: string): Promise<void> {
      if (!categories.has(categoryId) || owners.get(categoryId) !== userId) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId });
      }
    },
  };
}
