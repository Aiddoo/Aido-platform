import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { todoCommentParamsSchema } from '../schemas/todo-comment-params.schema';

export function useTodoCommentParams() {
  const [params] = useRouteParams(todoCommentParamsSchema);

  return [params] as const;
}

/** 화면(`/todo/42`)과 펼친 피드 pane(`/feed?todoId=42`)이 같은 이름을 쓰므로 바꿀 때도 search만 바꾼다 */
export function useTodoCommentSort() {
  const [{ sort }, setParams] = useRouteParams(todoCommentParamsSchema);
  const setSort = (next: typeof sort) => setParams({ sort: next, comment: undefined });

  return [sort, setSort] as const;
}
