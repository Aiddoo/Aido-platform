import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { getCachedTodoTitles } from '@src/features/planning/todo/queries/todo-cache';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getSpeechContextStrings } from '../utils/speech-context';

/** 캐시에 있는 값만 읽고 따로 요청하지 않는다. 듣기 시작 때만 필요해 렌더에 구독하지 않는다 */
export function useReadSpeechContext() {
  const queryClient = useQueryClient();
  const categoriesQueryKey = useGetTodoCategoriesQueryOptions().queryKey;

  return useCallback(() => {
    // oxlint-disable-next-line aido/query-client-location -- 1.15.2 전환 #1400
    const categories = queryClient.getQueryData(categoriesQueryKey)?.categories ?? [];

    return getSpeechContextStrings({
      categoryNames: categories.map((category) => category.name),
      todoTitles: getCachedTodoTitles(queryClient),
    });
  }, [queryClient, categoriesQueryKey]);
}
