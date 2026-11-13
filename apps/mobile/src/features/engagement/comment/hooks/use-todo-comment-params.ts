import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import { todoCommentParamsSchema } from '../schemas/todo-comment-params.schema';

/** 정렬과 알림으로 연 댓글 위치를 `[values]`로 읽는다 */
export function useTodoCommentParams() {
  const [params] = useRouteParams(todoCommentParamsSchema);

  return [params] as const;
}

/**
 * 정렬을 바꾸면 새 정렬에서 맞지 않는 `comment` 위치도 함께 지운다. 화면(`/todo/42`)과 펼친 피드 pane(`/feed?todoId=42`)이
 * 같은 이름을 쓰므로 바꿀 때도 search만 바꾼다.
 */
export function useTodoCommentSort() {
  const [{ sort }, setParams] = useRouteParams(todoCommentParamsSchema);
  const setSort = useCallback(
    (next: typeof sort) => setParams({ sort: next, comment: undefined }),
    [setParams],
  );

  return [sort, setSort] as const;
}
