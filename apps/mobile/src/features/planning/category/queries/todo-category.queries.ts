import { useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';

export function useGetTodoCategoriesQueryOptions() {
  const todoCategoryService = useTodoCategoryService();

  return queryOptions({
    queryKey: TODO_CATEGORY_QUERY_KEYS.list(),
    queryFn: async ({ signal }) => unwrap(await todoCategoryService.getCategories(signal)),
    ...PERSISTED_QUERY_OPTIONS,
  });
}
