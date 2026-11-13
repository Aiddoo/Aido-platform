import { getCachedTodoCategories } from '@src/features/planning/category/queries/todo-category-cache';
import { getCachedTodoTitles } from '@src/features/planning/todo/queries/todo-cache';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getSpeechContextStrings } from '../domains/speech-context.model';

/** 캐시에 있는 값만 읽고 따로 요청하지 않는다. 듣기 시작 때만 필요해 렌더에 구독하지 않는다 */
export function useReadSpeechContext() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    const categories = getCachedTodoCategories(queryClient)?.categories ?? [];

    return getSpeechContextStrings({
      categoryNames: categories.map((category) => category.name),
      todoTitles: getCachedTodoTitles(queryClient),
    });
  }, [queryClient]);
}
