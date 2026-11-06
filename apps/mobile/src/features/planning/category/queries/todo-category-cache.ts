import type { QueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';

export function invalidateTodoCategories(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
}
