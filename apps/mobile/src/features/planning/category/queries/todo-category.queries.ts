import { useTodoCategoryApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { queryOptions } from '@tanstack/react-query';

import type { FilterTodoCategory, TodoCategoriesResult } from '../domains/todo-category.model';
import { TODO_CATEGORY_QUERY_KEYS } from './todo-category-query-keys';

export function useGetTodoCategoriesQueryOptions({
  filters,
}: { filters?: FilterTodoCategory } = {}) {
  const todoCategoryApi = useTodoCategoryApi();

  return queryOptions({
    queryKey: TODO_CATEGORY_QUERY_KEYS.list(),
    queryFn: async ({ signal }) => unwrap(await todoCategoryApi.getCategories(signal)),
    select:
      filters == null
        ? undefined
        : (result: TodoCategoriesResult) => ({
            ...result,
            categories: result.categories.filter(filters),
          }),
    ...PERSISTED_QUERY_OPTIONS,
  });
}

export function useGetTodoCategoryDeletionPreviewQueryOptions({
  categoryId,
}: {
  categoryId: number;
}) {
  const todoCategoryApi = useTodoCategoryApi();

  return queryOptions({
    queryKey: TODO_CATEGORY_QUERY_KEYS.deletionPreview({ categoryId }),
    // 읽는 동안 시트를 띄우지 않으므로 오프라인·장애에 멈추거나 재시도로 기다리지 않고 바로 실패해 다시 시도를 보인다
    networkMode: 'always',
    retry: false,
    queryFn: async ({ signal }) =>
      unwrap(await todoCategoryApi.getDeletionPreview(categoryId, signal)),
  });
}
