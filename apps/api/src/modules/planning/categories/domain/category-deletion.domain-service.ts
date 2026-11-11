import type { CategoryTodoHandling } from "@aido/api/vocabulary";

import type { CATEGORY_DELETION_REJECTIONS } from "./categories.constants.js";
import type { TodoCategoryId } from "./todo-category-id.vo.js";

export type CategoryDeletionRejection = (typeof CATEGORY_DELETION_REJECTIONS)[number];

export type CategoryDeletionPlan =
  | { readonly ok: true; readonly plan: "delete-empty" }
  | { readonly ok: true; readonly plan: "move"; readonly moveToCategoryId: TodoCategoryId }
  | { readonly ok: true; readonly plan: "delete-with-todos" }
  | { readonly ok: false; readonly reason: CategoryDeletionRejection };

export interface CategoryDeletionInput {
  readonly categoryId: TodoCategoryId;
  readonly categoryCount: number;
  readonly todoCount: number;
  readonly activeSeriesCount: number;
  /** null은 출시 앱(1.15.0까지)의 요청이다. 옮길 곳이 있으면 옮기고 없으면 거절한다 */
  readonly todoHandling: CategoryTodoHandling | null;
  readonly moveToCategoryId: TodoCategoryId | null;
}

// 거절 순서(마지막 카테고리 → 옮길 곳)와 빈 카테고리에서 옮길 곳을 보지 않는 것은 출시 앱이 받던 응답 그대로다
export function planCategoryDeletion(input: CategoryDeletionInput): CategoryDeletionPlan {
  if (input.categoryCount <= 1) {
    return { ok: false, reason: "last-category" };
  }
  // 회차가 아직 없어도 진행 중 규칙이 있으면 비어 있지 않다
  if (input.todoCount + input.activeSeriesCount === 0) {
    return { ok: true, plan: "delete-empty" };
  }
  if (input.todoHandling === "delete") {
    return input.moveToCategoryId == null
      ? { ok: true, plan: "delete-with-todos" }
      : { ok: false, reason: "move-target-not-allowed" };
  }
  if (input.moveToCategoryId == null) {
    return { ok: false, reason: "move-target-required" };
  }
  if (input.moveToCategoryId.equals(input.categoryId)) {
    return { ok: false, reason: "same-target" };
  }
  return { ok: true, plan: "move", moveToCategoryId: input.moveToCategoryId };
}
