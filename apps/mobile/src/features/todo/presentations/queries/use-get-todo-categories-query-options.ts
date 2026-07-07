import { useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys.constant';

export const useGetTodoCategoriesQueryOptions = () => {
  const todoCategoryService = useTodoCategoryService();

  return queryOptions({
    queryKey: TODO_CATEGORY_QUERY_KEYS.list(),
    queryFn: async () => {
      const result = await todoCategoryService.getCategories();

      return unwrap(result);
    },
  });
};
