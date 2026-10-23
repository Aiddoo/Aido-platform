import { todoDetailsParamSchema } from '@aido/api';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useRouteSearchParams } from '@src/shared/providers/route-search-params-provider';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

import { resolveFeedTodoSelection } from '../utils/feed-todo-selection';

const feedSelectedTodoParamsSchema = z.object({
  todoId: routeIntegerStringSchema
    .pipe(todoDetailsParamSchema.shape.todoId)
    .optional()
    .catch(undefined),
});

type FeedSelectedTodoId = z.output<typeof feedSelectedTodoParamsSchema>['todoId'];

/** 피드 URL의 `todoId`를 선택된 할 일로 읽고, 화면 크기에 맞는 방식으로 선택을 바꾼다. */
export function useFeedSelectedTodo(): readonly [
  FeedSelectedTodoId,
  (todoId: number | undefined) => void,
] {
  const { todoId: selectedTodoId } = feedSelectedTodoParamsSchema.parse(useRouteSearchParams());
  const windowSizeClass = useWindowSizeClass();

  const setSelectedTodoId = useCallback(
    (todoId: number | undefined) => {
      const navigation = resolveFeedTodoSelection(windowSizeClass, todoId);

      if (navigation.type === 'push') {
        router.push({ pathname: '/todo/[todoId]', params: { todoId: navigation.todoId } });
        return;
      }

      if (navigation.type === 'setParams') {
        router.setParams(navigation.params);
      }
    },
    [windowSizeClass],
  );

  return [selectedTodoId, setSelectedTodoId] as const;
}
