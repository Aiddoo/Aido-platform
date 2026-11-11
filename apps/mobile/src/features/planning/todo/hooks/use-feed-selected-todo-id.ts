import { useOpenDetailWhenCompact } from '@src/shared/hooks/use-open-detail-when-compact';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { usePaneSizeClass } from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { match, P } from 'ts-pattern';

import { CLEARED_TODO_SELECTION, feedParamsSchema } from '../schemas/feed-params.schema';

/** 접힌 화면은 상세로 push, 펼친 화면은 칸을 바꾼다. 할 일이 바뀌면 댓글 위치·정렬을 버리고 같은 할 일은 그대로 둔다 */
export function useFeedSelectedTodoId() {
  const [{ todoId: selectedTodoId }, setParams] = useRouteParams(feedParamsSchema);
  const paneSizeClass = usePaneSizeClass();

  const setSelectedTodoId = useCallback(
    (todoId: number | undefined) => {
      match({ paneSizeClass, todoId })
        .with({ paneSizeClass: 'compact', todoId: P.nullish }, noop)
        .with({ paneSizeClass: 'compact', todoId: P.number }, ({ todoId: selected }) =>
          router.push({ pathname: '/todo/[todoId]', params: { todoId: selected } }),
        )
        .with({ paneSizeClass: P.union('medium', 'expanded') }, () => {
          if (todoId !== selectedTodoId) {
            setParams({ ...CLEARED_TODO_SELECTION, todoId });
          }
        })
        .exhaustive();
    },
    [paneSizeClass, selectedTodoId, setParams],
  );

  return [selectedTodoId, setSelectedTodoId] as const;
}

/** 펼친 화면에서 고른 할 일이 있는 채로 접히면 그 할 일과 댓글 위치를 상세 화면으로 넘긴다 */
export function useFeedTodoDetailHandoff() {
  const [{ todoId: selectedTodoId, sort, comment }, setParams] = useRouteParams(feedParamsSchema);

  useOpenDetailWhenCompact(selectedTodoId, (todoId) => {
    setParams(CLEARED_TODO_SELECTION);
    router.push({ pathname: '/todo/[todoId]', params: { todoId, sort, comment } });
  });
}
