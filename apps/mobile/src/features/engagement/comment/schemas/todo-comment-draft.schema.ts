import { TODO_COMMENT_LIMITS } from '@aido/api/vocabulary';
import { z } from 'zod';

// 길이 제한은 제출 시 작성기 스키마가 검사한다. 초안은 쓰던 글을 그대로 돌려준다.
export const todoCommentDraftSchema = z.object({
  items: z
    .array(z.object({ content: z.string() }))
    .min(1)
    .max(TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE),
});
