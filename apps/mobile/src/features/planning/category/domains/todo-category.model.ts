import type { TodoCategoryFormValues } from '../schemas/todo-category-form.schema';
import type { TodoCategory } from '../schemas/todo-category.schema';

/** 시트 route가 가리키는 카테고리. 목록에서 사라졌으면(삭제된 뒤) null */
function findCategory<T extends Pick<TodoCategory, 'id'>>(
  categories: readonly T[],
  categoryId: number,
): T | null {
  return categories.find((category) => category.id === categoryId) ?? null;
}

/** 요청한 카테고리가 아직 있으면 그것을, 없으면 첫 카테고리를 처음 선택값으로 쓴다 */
function getInitialCategoryId(
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

/** 바뀐 값이 없으면 요청을 보내지 않는다 */
function hasChanges(category: Pick<TodoCategory, 'name' | 'color'>, form: TodoCategoryFormValues) {
  return category.name !== form.name || category.color !== form.color;
}

export const TodoCategoryPolicy = {
  findCategory,
  getInitialCategoryId,
  hasChanges,
} as const;
