import type { TodoCategory, TodoCategoryWithCount } from '../schemas/todo-category.schema';

const MIN_REORDERABLE_COUNT = 2;

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
function hasChanges(
  category: Pick<TodoCategory, 'name' | 'color'>,
  values: Pick<TodoCategory, 'name' | 'color'>,
) {
  return category.name !== values.name || category.color !== values.color;
}

/** 할 일이 남은 카테고리는 바로 지우지 못하고 할 일을 다른 카테고리로 옮겨야 한다 */
function requiresTodoMove(category: Pick<TodoCategoryWithCount, 'todoCount'>) {
  return category.todoCount > 0;
}

function canReorderCategories(categories: readonly Pick<TodoCategory, 'id'>[]) {
  return categories.length >= MIN_REORDERABLE_COUNT;
}

export const TodoCategoryPolicy = {
  requiresTodoMove,
  canReorderCategories,
  findCategory,
  getInitialCategoryId,
  hasChanges,
} as const;
