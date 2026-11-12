import { CATEGORY_TODO_HANDLING_RESULTS, CATEGORY_TODO_HANDLINGS } from '@aido/api/vocabulary';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

export const todoCategoryDeletionPreviewSchema = z.object({
  todoCount: z.int().nonnegative(),
  completedTodoCount: z.int().nonnegative(),
  activeSeriesCount: z.int().nonnegative(),
  isLastCategory: z.boolean(),
});
export type TodoCategoryDeletionPreview = z.infer<typeof todoCategoryDeletionPreviewSchema>;

const todoCategoryDeletionChoiceSchema = z.object({
  todoHandling: z.enum(CATEGORY_TODO_HANDLINGS),
  moveToCategoryId: z.int().nullable(),
});
export type TodoCategoryDeletionChoice = z.infer<typeof todoCategoryDeletionChoiceSchema>;

// 처리 방식이 null이면 보내지 않는다. 옮기거나 지울 할 일이 없어서다
const todoCategoryDeletionRequestSchema = z.object({
  todoHandling: z.enum(CATEGORY_TODO_HANDLINGS).nullable(),
  moveToCategoryId: z.int().nullable(),
});
export type TodoCategoryDeletionRequest = z.infer<typeof todoCategoryDeletionRequestSchema>;

const todoCategoryDeletionResultSchema = z.object({
  todoHandling: z.enum(CATEGORY_TODO_HANDLING_RESULTS),
  todoCount: z.int().nonnegative(),
  seriesCount: z.int().nonnegative(),
  moveToCategoryId: z.int().nullable(),
});
export type TodoCategoryDeletionResult = z.infer<typeof todoCategoryDeletionResultSchema>;

// 삭제 화면은 TodoCategoryDeletionPolicy만 쓴다. 미리보기 모델 전체를 먼저 받는다
// 서버는 마지막 카테고리를 지우지 않는다(TODO_CATEGORY_0854)
export function canDelete(preview: TodoCategoryDeletionPreview) {
  return !preview.isLastCategory;
}

// 옮기거나 함께 지울 할 일·진행 중 반복이 있을 때만 처리 방식을 묻고, 없으면 확인만 받는다
export function shouldChooseTodoHandling(preview: TodoCategoryDeletionPreview) {
  return canDelete(preview) && hasTodosToHandle(preview.todoCount, preview.activeSeriesCount);
}

// 완료한 할 일을 함께 지우면 달력의 날짜별 완료 기록에서도 빠진다. 연속 기록과 지난 주간 달성은 저장된 값이라 그대로다
export function shouldWarnHistoryLoss(preview: TodoCategoryDeletionPreview) {
  return preview.completedTodoCount > 0;
}

/** 고른 처리로 보낼 삭제. 마지막 카테고리, 옮길 곳 없는 옮기기, 고르지 않은 처리는 보낼 수 없어 null이다 */
export function toDeletionRequest(
  preview: TodoCategoryDeletionPreview,
  choice: TodoCategoryDeletionChoice | null,
): TodoCategoryDeletionRequest | null {
  if (!canDelete(preview)) {
    return null;
  }
  if (!shouldChooseTodoHandling(preview)) {
    return { todoHandling: null, moveToCategoryId: null };
  }
  if (choice == null) {
    return null;
  }

  return match(choice)
    .returnType<TodoCategoryDeletionRequest | null>()
    .with({ todoHandling: 'delete' }, () => ({ todoHandling: 'delete', moveToCategoryId: null }))
    .with({ todoHandling: 'move', moveToCategoryId: P.nullish }, () => null)
    .with({ todoHandling: 'move', moveToCategoryId: P.number }, ({ moveToCategoryId }) => ({
      todoHandling: 'move',
      moveToCategoryId,
    }))
    .exhaustive();
}

export const TodoCategoryDeletionPolicy = {
  canDelete,
  shouldChooseTodoHandling,
  shouldWarnHistoryLoss,
  toDeletionRequest,
} as const;

export function hasTodosToHandle(todoCount: number, activeSeriesCount: number) {
  return todoCount > 0 || activeSeriesCount > 0;
}
