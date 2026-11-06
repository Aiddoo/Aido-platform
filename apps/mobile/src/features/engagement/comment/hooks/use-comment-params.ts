import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { commentParamsSchema } from '../schemas/comment-params.schema';

/**
 * 정렬과 알림으로 연 댓글 위치를 `[values, setValues]`로 읽고 바꾼다. 화면(`/todo/42`)과 펼친 피드 pane(`/feed?todoId=42`)이
 * 같은 이름을 쓰므로 바꿀 때도 search만 바꾼다.
 */
export function useCommentParams() {
  return useRouteParams(commentParamsSchema);
}
