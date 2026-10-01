import { useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import type { TodoCategoryService } from '@src/features/todo/services/todo-category.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys.constant';

export function getTodoCategoriesQueryOptions(todoCategoryService: TodoCategoryService) {
  return queryOptions({
    queryKey: TODO_CATEGORY_QUERY_KEYS.list(),
    queryFn: async ({ signal }) => {
      const result = await todoCategoryService.getCategories(signal);

      return unwrap(result);
    },
  });
}

export function useGetTodoCategoriesQueryOptions() {
  return getTodoCategoriesQueryOptions(useTodoCategoryService());
}
