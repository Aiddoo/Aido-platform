import { useTodoCategoryService } from '@src/bootstrap/providers/di-provider';
import { queryOptions } from '@tanstack/react-query';

import { todoCategoryQueryKeys } from './todo-category-query-keys.constant';

export const getCategoriesQueryOptions = () => {
  const todoCategoryService = useTodoCategoryService();

  return queryOptions({
    queryKey: todoCategoryQueryKeys.list(),
    queryFn: () => todoCategoryService.getCategories(),
    staleTime: 1000 * 60 * 5, // 5분
  });
};
