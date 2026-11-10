import type { QueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import type {
  TodoCategoriesResult,
  TodoCategory,
  TodoCategoryWithCount,
} from '../domains/todo-category.model';

export function withCategoryAdded(
  result: TodoCategoriesResult,
  category: TodoCategoryWithCount,
): TodoCategoriesResult {
  return { ...result, categories: [...result.categories, category] };
}

export function withCategoryChanged(
  result: TodoCategoriesResult,
  categoryId: number,
  change: Partial<Pick<TodoCategory, 'name' | 'color'>>,
): TodoCategoriesResult {
  return {
    ...result,
    categories: result.categories.map((category) =>
      category.id === categoryId ? { ...category, ...change } : category,
    ),
  };
}

export function withCategoryRemoved(
  result: TodoCategoriesResult,
  categoryId: number,
): TodoCategoriesResult {
  return { ...result, categories: result.categories.filter(({ id }) => id !== categoryId) };
}

/** 할 일을 만들거나 지운 만큼 그 카테고리의 개수만 바꾼다. 개수는 서버가 세는 카테고리의 할 일 수와 같다 */
export function withTodoCountChanged(
  result: TodoCategoriesResult,
  categoryId: number,
  delta: number,
): TodoCategoriesResult {
  return {
    ...result,
    categories: result.categories.map((category) =>
      category.id === categoryId
        ? { ...category, todoCount: Math.max(0, category.todoCount + delta) }
        : category,
    ),
  };
}

export function invalidateTodoCategories(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
}

/** 할 일 하나를 만들거나 지운 응답으로 개수를 고친다. 목록 전체를 다시 받지 않는다 */
export function changeCachedCategoryTodoCount(
  queryClient: QueryClient,
  { categoryId, delta }: { categoryId: number; delta: number },
) {
  queryClient.setQueryData(
    TODO_CATEGORY_QUERY_KEYS.list(),
    (old) => old && withTodoCountChanged(old, categoryId, delta),
  );
}
