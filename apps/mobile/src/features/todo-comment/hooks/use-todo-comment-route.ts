import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';

import {
  parseTodoCommentRoute,
  serializeTodoCommentRoute,
  type TodoCommentRoute,
} from '../utils/navigation/todo-comment-route';

/**
 * 정렬과 알림으로 연 댓글 위치를 URL search에서 읽는다. 화면(`/todo/42`)과 펼친 피드 pane(`/feed?todoId=42`)이
 * 같은 이름을 쓰므로 바꿀 때도 search만 바꾼다.
 */
export function useTodoCommentRoute() {
  const { sort, comment } = useLocalSearchParams();
  const commentRoute = useMemo(() => parseTodoCommentRoute({ sort, comment }), [comment, sort]);

  const setCommentRoute = useCallback(
    (next: Partial<TodoCommentRoute>) => {
      router.setParams(serializeTodoCommentRoute({ ...commentRoute, ...next }));
    },
    [commentRoute],
  );

  return [commentRoute, setCommentRoute] as const;
}
