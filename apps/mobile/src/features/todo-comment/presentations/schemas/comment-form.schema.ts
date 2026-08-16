import { TODO_COMMENT_LIMITS, todoCommentContentSchema } from '@aido/validators';
import { z } from 'zod';

/**
 * 한 번에 이어 쓰는 글 묶음. 서버와 같은 규칙을 쓰려고 계약 스키마를 그대로 재사용한다.
 * 칸이 하나라도 비어 있으면 전체가 무효라, "모두 채워야 게시가 열린다"가 여기 한 곳에서 표현된다.
 */
export const commentFormSchema = z.object({
  items: z
    .array(z.object({ content: todoCommentContentSchema }))
    .min(1)
    .max(TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE),
});

export type CommentFormInput = z.infer<typeof commentFormSchema>;
