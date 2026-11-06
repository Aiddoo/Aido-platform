import { useCompactDetailHandoff } from '@src/shared/hooks/use-compact-detail-handoff';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { match, P } from 'ts-pattern';

import { CLEARED_TODO_SELECTION, feedParamsSchema } from '../schemas/feed-params.schema';

/**
 * 피드 URL의 `todoId`를 선택된 할 일로 읽는다. 접힌 화면은 상세 화면으로 push하고, 펼친 화면은 상세 칸을 바꾼다.
 * 칸의 할 일이 바뀌면 그 할 일에 딸린 댓글 위치와 정렬은 버린다. 이미 고른 할 일을 다시 누르면 그대로 둔다.
 */
export function useFeedSelectedTodo() {
  const [{ todoId: selectedTodoId }, setParams] = useRouteParams(feedParamsSchema);
  const windowSizeClass = useWindowSizeClass();

  const setSelectedTodoId = useCallback(
    (todoId: number | undefined) => {
      match({ windowSizeClass, todoId })
        .with({ windowSizeClass: 'compact', todoId: P.nullish }, noop)
        .with({ windowSizeClass: 'compact', todoId: P.number }, ({ todoId: selected }) =>
          router.push({ pathname: '/todo/[todoId]', params: { todoId: selected } }),
        )
        .with({ windowSizeClass: P.union('medium', 'expanded') }, () => {
          if (todoId !== selectedTodoId) {
            setParams({ ...CLEARED_TODO_SELECTION, todoId });
          }
        })
        .exhaustive();
    },
    [windowSizeClass, selectedTodoId, setParams],
  );

  return [selectedTodoId, setSelectedTodoId] as const;
}

/** 펼친 화면에서 고른 할 일이 있는 채로 접히면 그 할 일과 댓글 위치를 상세 화면으로 넘긴다 */
export function useFeedTodoDetailHandoff() {
  const [{ todoId: selectedTodoId, sort, comment }, setParams] = useRouteParams(feedParamsSchema);

  useCompactDetailHandoff(selectedTodoId, (todoId) => {
    setParams(CLEARED_TODO_SELECTION);
    router.push({ pathname: '/todo/[todoId]', params: { todoId, sort, comment } });
  });
}
