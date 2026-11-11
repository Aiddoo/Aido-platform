import { useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
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

export function useGetTodoCategoryDeletionPreviewQueryOptions({
  categoryId,
}: {
  categoryId: number;
}) {
  const todoCategoryService = useTodoCategoryService();

  return queryOptions({
    queryKey: TODO_CATEGORY_QUERY_KEYS.deletionPreview({ categoryId }),
    // 읽는 동안 시트를 띄우지 않으므로 오프라인·장애에 멈추거나 재시도로 기다리지 않고 바로 실패해 다시 시도를 보인다
    networkMode: 'always',
    retry: false,
    queryFn: async ({ signal }) =>
      unwrap(await todoCategoryService.getDeletionPreview(categoryId, signal)),
  });
}
