import { useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import type { TodoCategoryService } from '@src/features/planning/category/apis/todo-category.service';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';

function getTodoCategoriesQueryOptions(todoCategoryService: TodoCategoryService) {
  return queryOptions({
    queryKey: TODO_CATEGORY_QUERY_KEYS.list(),
    queryFn: async ({ signal }) => {
      const result = await todoCategoryService.getCategories(signal);

      return unwrap(result);
    },
    ...PERSISTED_QUERY_OPTIONS,
  });
}

export function useGetTodoCategoriesQueryOptions() {
  return getTodoCategoriesQueryOptions(useTodoCategoryService());
}
