import type { CategoryTodoHandlingResult } from "@aido/api/vocabulary";

/** 삭제가 실제로 한 일. 수는 잠금 아래에서 읽은 값이라 옮기거나 지운 행과 같다 */
export interface TodoCategoryDeletionReadModel {
  readonly todoHandling: CategoryTodoHandlingResult;
  readonly todoCount: number;
  /** 진행 중 반복 규칙 수. 끝난 규칙은 사용자에게 보이지 않아 세지 않는다 */
  readonly seriesCount: number;
  readonly moveToCategoryId: number | null;
}

export interface TodoCategoryDeletionPreviewReadModel {
  readonly categoryId: number;
  readonly todoCount: number;
  readonly completedTodoCount: number;
  readonly activeSeriesCount: number;
  readonly isLastCategory: boolean;
}
