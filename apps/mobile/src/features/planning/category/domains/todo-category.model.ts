import { CATEGORY_TODO_HANDLING_RESULTS, CATEGORY_TODO_HANDLINGS } from '@aido/api/vocabulary';
import { minBy } from 'es-toolkit';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

// 임시 행은 음수 id라 id를 양수로 막지 않는다
export const todoCategorySchema = z.object({
  id: z.int(),
  name: z.string(),
  color: z.string(),
  sortOrder: z.int(),
});
export type TodoCategory = z.infer<typeof todoCategorySchema>;

export const todoCategoryWithCountSchema = todoCategorySchema.extend({
  todoCount: z.number(),
});
export type TodoCategoryWithCount = z.infer<typeof todoCategoryWithCountSchema>;

export const todoCategoriesResultSchema = z.object({
  categories: z.array(todoCategoryWithCountSchema),
});
export type TodoCategoriesResult = z.infer<typeof todoCategoriesResultSchema>;

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

const MIN_REORDERABLE_COUNT = 2;

// 화면은 TodoCategoryPolicy만 쓴다. 카테고리와 목록은 모델 전체를 받는다

// id가 가리키는 카테고리(시트 route, 칩, 분석이 쓴다). 목록에서 사라졌으면(삭제된 뒤) null
export function findCategory<T extends TodoCategory>(
  categories: readonly T[],
  categoryId: number,
): T | null {
  return categories.find((category) => category.id === categoryId) ?? null;
}

// 요청한 카테고리가 아직 있으면 그것을, 없으면 첫 카테고리를 처음 선택값으로 쓴다
export function getInitialCategoryId(
  categories: readonly TodoCategory[],
  requestedCategoryId: number | null,
): number | null {
  if (requestedCategoryId != null && findCategory(categories, requestedCategoryId) != null) {
    return requestedCategoryId;
  }

  return categories[0]?.id ?? null;
}

// 바뀐 값이 없으면 요청을 보내지 않는다
export function hasChanges(category: TodoCategory, values: Pick<TodoCategory, 'name' | 'color'>) {
  return category.name !== values.name || category.color !== values.color;
}

// 서버 응답 전의 임시 행은 음수 id다. 임시 id로는 요청을 보낼 수 없어 행 버튼·옮길 곳·순서 바꾸기에서 뺀다
export function isOptimisticCategory(category: TodoCategory) {
  return category.id < 0;
}

export function canReorder(categories: readonly TodoCategory[]) {
  return categories.length >= MIN_REORDERABLE_COUNT;
}

// 지우는 카테고리로는 옮길 수 없다. 서버 id가 없는 임시 행은 부르는 쪽이 먼저 뺀다
export function getMoveTargets<T extends TodoCategory>(
  category: TodoCategory,
  categories: readonly T[],
): T[] {
  return excludeCategory(categories, category.id);
}

/** 할 일을 옮길 곳. 고른 곳이 아직 옮길 수 있으면 그것을, 아니면 정렬 순서가 가장 앞인 카테고리를 쓴다 */
export function findMoveTarget<T extends TodoCategory>(
  category: TodoCategory,
  categories: readonly T[],
  pickedCategoryId: number | null,
): T | null {
  const moveTargets = getMoveTargets(category, categories);
  const pickedMoveTarget =
    pickedCategoryId == null ? null : findCategory(moveTargets, pickedCategoryId);

  return pickedMoveTarget ?? findFirstInSortOrder(moveTargets);
}

export const TodoCategoryPolicy = {
  findCategory,
  getInitialCategoryId,
  hasChanges,
  isOptimisticCategory,
  canReorder,
  getMoveTargets,
  findMoveTarget,
} as const;

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

// 정책이 조합하는 순수 함수. 필요한 값만 받는다

export function excludeCategory<T extends Pick<TodoCategory, 'id'>>(
  categories: readonly T[],
  categoryId: number,
): T[] {
  return categories.filter((category) => category.id !== categoryId);
}

export function findFirstInSortOrder<T extends Pick<TodoCategory, 'sortOrder'>>(
  categories: readonly T[],
): T | null {
  return minBy(categories, (category) => category.sortOrder) ?? null;
}

export function hasTodosToHandle(todoCount: number, activeSeriesCount: number) {
  return todoCount > 0 || activeSeriesCount > 0;
}
