import { ErrorCode } from "@aido/api/errors";
import { match } from "ts-pattern";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { CategoryDeletionRejection } from "../domain/category-deletion.domain-service.js";
import type { TodoCategoryId } from "../domain/todo-category-id.vo.js";

export function todoCategoryNotFound(categoryId: TodoCategoryId): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId: categoryId.value });
}

// 코드·details·문구는 출시 앱이 받던 그대로다(0855 details의 todoCount, 같은 대상 SYS_0002 문구)
export function categoryDeletionRejected(params: {
  readonly reason: CategoryDeletionRejection;
  readonly categoryId: TodoCategoryId;
  readonly moveToCategoryId: TodoCategoryId | null;
  readonly todoCount: number;
}): ApplicationException {
  const categoryId = params.categoryId.value;
  const moveToCategoryId = params.moveToCategoryId?.value;
  return match(params.reason)
    .with("last-category", () => new ApplicationException(ErrorCode.TODO_CATEGORY_0854))
    .with(
      "move-target-required",
      () =>
        new ApplicationException(ErrorCode.TODO_CATEGORY_0855, {
          categoryId,
          todoCount: params.todoCount,
        }),
    )
    .with(
      "same-target",
      () =>
        new ApplicationException(ErrorCode.SYS_0002, {
          message: "삭제할 카테고리와 이동 대상 카테고리가 같을 수 없습니다",
          categoryId,
          moveToCategoryId,
        }),
    )
    .with(
      "move-target-not-allowed",
      () =>
        new ApplicationException(ErrorCode.SYS_0002, {
          message: "할 일을 함께 삭제할 때는 이동할 카테고리를 지정할 수 없습니다",
          categoryId,
          moveToCategoryId,
        }),
    )
    .exhaustive();
}
