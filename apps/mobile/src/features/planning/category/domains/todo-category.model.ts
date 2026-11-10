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

const MIN_REORDERABLE_COUNT = 2;

// id가 가리키는 카테고리(시트 route, 칩, 분석이 쓴다). 목록에서 사라졌으면(삭제된 뒤) null
export function findCategory<T extends Pick<TodoCategory, 'id'>>(
  categories: readonly T[],
  categoryId: number,
): T | null {
  return categories.find((category) => category.id === categoryId) ?? null;
}

export function getMoveTargetCategories<T extends Pick<TodoCategory, 'id'>>(
  categories: readonly T[],
  deletingCategoryId: number,
): T[] {
  return categories.filter((category) => category.id !== deletingCategoryId);
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

// 할 일이 남은 카테고리는 바로 지우지 못하고 할 일을 다른 카테고리로 옮겨야 한다
export function isTodoMoveRequired(category: Pick<TodoCategoryWithCount, 'todoCount'>) {
  return category.todoCount > 0;
}

// 서버 응답 전의 임시 행. 임시 id로는 요청을 보낼 수 없다
export function isOptimisticCategory(category: Pick<TodoCategory, 'id'>) {
  return category.id < 0;
}

export function canReorderCategories(categories: readonly Pick<TodoCategory, 'id'>[]) {
  return categories.length >= MIN_REORDERABLE_COUNT;
}

export const TodoCategoryPolicy = {
  isTodoMoveRequired,
  canReorderCategories,
  isOptimisticCategory,
  findCategory,
  getMoveTargetCategories,
  getInitialCategoryId,
  hasChanges,
} as const;
