import { isOptimisticId } from '@src/shared/domains/optimistic-id.model';
import { canReorderItems } from '@src/shared/domains/reorderable-list.model';
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

/** 이름 찾기. 이름 어디에든 들어 있으면 남기고 앞뒤 공백·대소문자는 가리지 않는다. 빈 검색어는 모두 남긴다 */
export function filterByName(category: TodoCategory, query: string): boolean {
  const keyword = query.trim().toLocaleLowerCase();
  return keyword === '' || category.name.toLocaleLowerCase().includes(keyword);
}

// 목록 규칙은 카테고리 목록을 받는다. 아직 불러오지 않은 목록(undefined)은 빈 목록과 같다
export const TodoCategoryPolicy = {
  // id가 가리키는 카테고리(시트 route, 칩, 분석이 쓴다). 목록에서 사라졌으면(삭제된 뒤) null
  findCategory<T extends TodoCategory>(
    categories: readonly T[] | undefined,
    categoryId: number,
  ): T | null {
    return categories?.find((category) => category.id === categoryId) ?? null;
  },

  // 요청한 카테고리가 아직 있으면 그것을, 없으면 첫 카테고리를 처음 선택값으로 쓴다
  findInitialCategoryId(
    categories: readonly TodoCategory[] | undefined,
    requestedCategoryId: number | null,
  ): number | null {
    if (requestedCategoryId != null && this.findCategory(categories, requestedCategoryId) != null) {
      return requestedCategoryId;
    }

    return categories?.[0]?.id ?? null;
  },

  // 새 카테고리는 목록 맨 뒤에 붙는다. 서버가 순서를 줄 때까지 임시 행이 쓰는 값이다
  calculateNextSortOrder(categories: readonly TodoCategory[] | undefined): number {
    const last = categories?.at(-1);
    return last == null ? 1 : last.sortOrder + 1;
  },

  findFirstInSortOrder<T extends TodoCategory>(categories: readonly T[]): T | null {
    return minBy(categories, (category) => category.sortOrder) ?? null;
  },

  // 바뀐 값이 없으면 요청을 보내지 않는다
  hasChanges(category: TodoCategory, values: Pick<TodoCategory, 'name' | 'color'>): boolean {
    return category.name !== values.name || category.color !== values.color;
  },

  // 임시 행은 행 버튼·옮길 곳·순서 바꾸기에서 뺀다
  isOptimisticCategory(category: TodoCategory): boolean {
    return isOptimisticId(category.id);
  },

  canReorder(categories: readonly TodoCategory[]): boolean {
    return canReorderItems(categories.length);
  },

  // 지우는 카테고리 자신과 서버 id가 없는 임시 행으로는 할 일을 옮길 수 없다
  isMoveTarget(category: TodoCategory, deletingCategory: TodoCategory): boolean {
    return category.id !== deletingCategory.id && !this.isOptimisticCategory(category);
  },

  /** 할 일을 옮길 곳. 고른 곳이 아직 옮길 수 있으면 그것을, 아니면 정렬 순서가 가장 앞인 카테고리를 쓴다 */
  findMoveTarget<T extends TodoCategory>(
    category: TodoCategory,
    categories: readonly T[],
    pickedCategoryId: number | null,
  ): T | null {
    const moveTargets = categories.filter((target) => this.isMoveTarget(target, category));
    const pickedMoveTarget =
      pickedCategoryId == null ? null : this.findCategory(moveTargets, pickedCategoryId);

    return pickedMoveTarget ?? this.findFirstInSortOrder(moveTargets);
  },
};
