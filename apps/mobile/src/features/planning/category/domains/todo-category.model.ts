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

const optimisticTodoCategoryWithCountSchema = todoCategoryWithCountSchema.extend({
  optimistic: z.literal(true).readonly(),
});
export type OptimisticTodoCategoryWithCount = z.infer<typeof optimisticTodoCategoryWithCountSchema>;

export const todoCategoryDeletionPreviewSchema = z.object({
  todoCount: z.int().nonnegative(),
  completedTodoCount: z.int().nonnegative(),
  activeSeriesCount: z.int().nonnegative(),
  isLastCategory: z.boolean(),
  // 미리보기가 없는 옛 서버는 할 일을 옮기기만 해서 함께 삭제를 고를 수 없다
  isTodoHandlingSupported: z.boolean(),
});
export type TodoCategoryDeletionPreview = z.infer<typeof todoCategoryDeletionPreviewSchema>;

const todoCategoryDeletionChoiceSchema = z.object({
  todoHandling: z.enum(CATEGORY_TODO_HANDLINGS),
  moveToCategoryId: z.int().nullable(),
});
export type TodoCategoryDeletionChoice = z.infer<typeof todoCategoryDeletionChoiceSchema>;

// 처리 방식이 null이면 보내지 않는다. 옮기거나 지울 할 일이 없거나 옛 서버라서다
const todoCategoryDeletionSchema = z.object({
  todoHandling: z.enum(CATEGORY_TODO_HANDLINGS).nullable(),
  moveToCategoryId: z.int().nullable(),
});
export type TodoCategoryDeletion = z.infer<typeof todoCategoryDeletionSchema>;

const todoCategoryDeletionResultSchema = z.object({
  todoHandling: z.enum(CATEGORY_TODO_HANDLING_RESULTS),
  todoCount: z.int().nonnegative(),
  seriesCount: z.int().nonnegative(),
  moveToCategoryId: z.int().nullable(),
});
export type TodoCategoryDeletionResult = z.infer<typeof todoCategoryDeletionResultSchema>;

const MIN_REORDERABLE_COUNT = 2;

// id가 가리키는 카테고리(시트 route, 칩, 분석이 쓴다). 목록에서 사라졌으면(삭제된 뒤) null
export function findCategory<T extends Pick<TodoCategory, 'id'>>(
  categories: readonly T[],
  categoryId: number,
): T | null {
  return categories.find((category) => category.id === categoryId) ?? null;
}

// 지우는 카테고리와 아직 서버 id가 없는 임시 행으로는 할 일을 옮길 수 없다
export function getMoveTargetCategories<T extends Pick<TodoCategory, 'id'>>(
  category: Pick<TodoCategory, 'id'>,
  categories: readonly T[],
): T[] {
  return categories.filter(
    (candidate) => candidate.id !== category.id && !isOptimisticCategory(candidate),
  );
}

// 요청한 카테고리가 아직 있으면 그것을, 없으면 첫 카테고리를 처음 선택값으로 쓴다
export function getInitialCategoryId(
  categories: readonly Pick<TodoCategory, 'id'>[],
  requestedCategoryId: number | null | undefined,
): number | null {
  if (
    requestedCategoryId != null &&
    categories.some((category) => category.id === requestedCategoryId)
  ) {
    return requestedCategoryId;
  }

  return categories[0]?.id ?? null;
}

// 바뀐 값이 없으면 요청을 보내지 않는다
export function hasChanges(
  category: Pick<TodoCategory, 'name' | 'color'>,
  values: Pick<TodoCategory, 'name' | 'color'>,
) {
  return category.name !== values.name || category.color !== values.color;
}

// 서버는 마지막 카테고리를 지우지 않는다(TODO_CATEGORY_0854)
export function canDeleteCategory(preview: Pick<TodoCategoryDeletionPreview, 'isLastCategory'>) {
  return !preview.isLastCategory;
}

// 옮기거나 함께 지울 할 일·진행 중 반복이 있을 때만 처리 방식을 묻고, 없으면 확인만 받는다
export function shouldChooseTodoHandling(
  preview: Pick<TodoCategoryDeletionPreview, 'isLastCategory' | 'todoCount' | 'activeSeriesCount'>,
) {
  return canDeleteCategory(preview) && (preview.todoCount > 0 || preview.activeSeriesCount > 0);
}

// 옛 서버는 처리 방식을 받지 않아 옮기기만 할 수 있다
export function canDeleteTodosTogether(
  preview: Pick<TodoCategoryDeletionPreview, 'isTodoHandlingSupported'>,
) {
  return preview.isTodoHandlingSupported;
}

// 완료한 할 일을 함께 지우면 달력의 날짜별 완료 기록에서도 빠진다. 연속 기록과 지난 주간 달성은 저장된 값이라 그대로다
export function shouldWarnHistoryLoss(
  preview: Pick<TodoCategoryDeletionPreview, 'completedTodoCount'>,
) {
  return preview.completedTodoCount > 0;
}

/** 할 일을 옮길 곳. 고른 곳이 아직 옮길 수 있으면 그것을, 아니면 정렬 순서가 가장 앞인 카테고리를 쓴다 */
export function findMoveTarget<T extends Pick<TodoCategory, 'id' | 'sortOrder'>>(
  category: Pick<TodoCategory, 'id'>,
  categories: readonly T[],
  pickedCategoryId: number | null,
): T | null {
  const targets = getMoveTargetCategories(category, categories);

  return (
    targets.find((target) => target.id === pickedCategoryId) ??
    minBy(targets, (target) => target.sortOrder) ??
    null
  );
}

/** 미리보기가 없는 옛 서버에서는 목록의 할 일 수로 대신한다. 반복·완료 수는 알 수 없다 */
export function createFallbackDeletionPreview(
  category: Pick<TodoCategoryWithCount, 'todoCount'>,
  categories: readonly Pick<TodoCategory, 'id'>[],
): TodoCategoryDeletionPreview {
  return {
    todoCount: category.todoCount,
    completedTodoCount: 0,
    activeSeriesCount: 0,
    isLastCategory: categories.length <= 1,
    isTodoHandlingSupported: false,
  };
}

/** 고른 처리로 보낼 삭제. 마지막 카테고리, 옮길 곳 없는 옮기기, 고르지 않은 처리는 보낼 수 없어 null이다 */
export function createCategoryDeletion(
  preview: TodoCategoryDeletionPreview,
  choice: TodoCategoryDeletionChoice | null,
): TodoCategoryDeletion | null {
  if (!canDeleteCategory(preview)) {
    return null;
  }
  if (!shouldChooseTodoHandling(preview)) {
    return { todoHandling: null, moveToCategoryId: null };
  }
  if (choice == null) {
    return null;
  }

  return match(choice)
    .returnType<TodoCategoryDeletion | null>()
    .with({ todoHandling: 'delete' }, () =>
      canDeleteTodosTogether(preview) ? { todoHandling: 'delete', moveToCategoryId: null } : null,
    )
    .with({ todoHandling: 'move', moveToCategoryId: P.nullish }, () => null)
    .with({ todoHandling: 'move', moveToCategoryId: P.number }, ({ moveToCategoryId }) => ({
      // 옛 서버는 처리 방식을 몰라 출시 앱처럼 옮길 곳만 받는다
      todoHandling: preview.isTodoHandlingSupported ? 'move' : null,
      moveToCategoryId,
    }))
    .exhaustive();
}

// 서버 응답 전의 임시 행. 임시 id로는 요청을 보낼 수 없다
export function isOptimisticCategory(category: Pick<TodoCategory, 'id'>) {
  return category.id < 0;
}

export function canReorderCategories(categories: readonly Pick<TodoCategory, 'id'>[]) {
  return categories.length >= MIN_REORDERABLE_COUNT;
}

export const TodoCategoryPolicy = {
  canDeleteCategory,
  shouldChooseTodoHandling,
  canDeleteTodosTogether,
  shouldWarnHistoryLoss,
  findMoveTarget,
  createFallbackDeletionPreview,
  createCategoryDeletion,
  canReorderCategories,
  isOptimisticCategory,
  findCategory,
  getMoveTargetCategories,
  getInitialCategoryId,
  hasChanges,
} as const;
