import type { QueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import { TodoCategoryPolicy } from '../domains/todo-category.model';

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
    (old) => old && TodoCategoryPolicy.withTodoCountChanged(old, categoryId, delta),
  );
}
