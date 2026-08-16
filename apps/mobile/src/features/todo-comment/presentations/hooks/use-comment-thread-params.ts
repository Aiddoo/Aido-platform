import { todoCommentIdSchema, todoDetailsParamSchema } from '@aido/validators';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

/** URL에는 내비게이션 값만 둔다 — 공유·뒤로가기 대상이거나 쿼리 키인 것들. */
const commentThreadParamsSchema = todoDetailsParamSchema.extend({
  /** 지금 펼쳐 보는 댓글. 어느 깊이의 id를 줘도 서버가 조상 사슬을 채워 준다. */
  commentId: todoCommentIdSchema,
  /** 답글 버튼으로 진입하면 입력바에 바로 포커스를 준다. */
  compose: z.literal('1').optional(),
});

export function useCommentThreadParams() {
  const { todoId, commentId, compose } = commentThreadParamsSchema.parse(useLocalSearchParams());

  return { todoId, commentId, shouldAutoFocusInput: compose === '1' };
}
