import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { getCachedTodoTitles } from '@src/features/planning/todo/queries/todo-cache';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getSpeechContextStrings } from '../utils/speech-context';

/**
 * 인식기에 알려 줄 내 카테고리·최근 할 일 단어. 이미 캐시에 있는 값만 읽고 따로 요청하지 않는다.
 * 듣기를 시작하는 순간에만 필요해서 렌더에 구독하지 않고 읽는 함수를 돌려준다.
 */
export function useReadSpeechContext() {
  const queryClient = useQueryClient();
  const categoriesQueryKey = useGetTodoCategoriesQueryOptions().queryKey;

  return useCallback(() => {
    const categories = queryClient.getQueryData(categoriesQueryKey)?.categories ?? [];

    return getSpeechContextStrings({
      categoryNames: categories.map((category) => category.name),
      todoTitles: getCachedTodoTitles(queryClient),
    });
  }, [queryClient, categoriesQueryKey]);
}
