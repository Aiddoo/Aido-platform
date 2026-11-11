import { useTodoCategoryService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { queryOptions } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import { isDeletionPreviewUnsupportedError } from '../domains/todo-category.error';

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
    queryFn: async ({ signal }) => {
      const result = await todoCategoryService.getDeletionPreview(categoryId, signal);
      // 옛 서버는 미리보기가 없어 null로 두고, 시트가 목록의 할 일 수로 옮기기만 보인다
      if (!result.ok && isDeletionPreviewUnsupportedError(result.error)) {
        return null;
      }

      return unwrap(result);
    },
  });
}
