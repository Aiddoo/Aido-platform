import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import type { z } from 'zod';

import { commentParamsSchema } from '../schemas/comment-params.schema';

type CommentParams = z.output<typeof commentParamsSchema>;

/**
 * 정렬과 알림으로 연 댓글 위치를 URL search에서 읽는다. 화면(`/todo/42`)과 펼친 피드 pane(`/feed?todoId=42`)이
 * 같은 이름을 쓰므로 바꿀 때도 search만 바꾼다.
 */
export function useCommentParams() {
  const params = commentParamsSchema.parse(useLocalSearchParams());
  const { sort, comment } = params;

  const setCommentParams = useCallback(
    (next: Partial<CommentParams>) => {
      const merged = { sort, comment, ...next };
      router.setParams({ sort: merged.sort, comment: merged.comment ?? undefined });
    },
    [sort, comment],
  );

  return { sort, comment, setCommentParams };
}
