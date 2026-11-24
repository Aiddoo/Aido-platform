import { minBy } from 'es-toolkit';
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

export type FilterTodoCategory = (category: TodoCategoryWithCount) => boolean;

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
export function findInitialCategoryId(
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

/** 이름 찾기. 이름 어디에든 들어 있으면 남기고 앞뒤 공백·대소문자는 가리지 않는다. 빈 검색어는 모두 남긴다 */
export function filterByName(category: TodoCategory, query: string) {
  const keyword = query.trim().toLocaleLowerCase();
  return keyword === '' || category.name.toLocaleLowerCase().includes(keyword);
}

export function canReorder(categories: readonly TodoCategory[]) {
  return categories.length >= MIN_REORDERABLE_COUNT;
}

// 지우는 카테고리 자신과 서버 id가 없는 임시 행으로는 할 일을 옮길 수 없다
export function isMoveTarget(category: TodoCategory, deletingCategory: TodoCategory) {
  return category.id !== deletingCategory.id && !isOptimisticCategory(category);
}

/** 할 일을 옮길 곳. 고른 곳이 아직 옮길 수 있으면 그것을, 아니면 정렬 순서가 가장 앞인 카테고리를 쓴다 */
export function findMoveTarget<T extends TodoCategory>(
  category: TodoCategory,
  categories: readonly T[],
  pickedCategoryId: number | null,
): T | null {
  const moveTargets = categories.filter((target) => isMoveTarget(target, category));
  const pickedMoveTarget =
    pickedCategoryId == null ? null : findCategory(moveTargets, pickedCategoryId);

  return pickedMoveTarget ?? findFirstInSortOrder(moveTargets);
}

export const TodoCategoryPolicy = {
  findCategory,
  findInitialCategoryId,
  hasChanges,
  isOptimisticCategory,
  filterByName,
  canReorder,
  isMoveTarget,
  findMoveTarget,
} as const;

export function findFirstInSortOrder<T extends Pick<TodoCategory, 'sortOrder'>>(
  categories: readonly T[],
): T | null {
  return minBy(categories, (category) => category.sortOrder) ?? null;
}
