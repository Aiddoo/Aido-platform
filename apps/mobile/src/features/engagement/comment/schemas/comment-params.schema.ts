import { TODO_COMMENT_SORT, todoCommentIdSchema } from '@aido/api';
import { z } from 'zod';

/** 할 일 상세의 URL 상태. 정렬과 알림·링크로 연 댓글 위치만 둔다. 없거나 잘못된 값은 최신순·위치 없음이다 */
export const commentParamsSchema = z.object({
  sort: z.enum(TODO_COMMENT_SORT).catch(TODO_COMMENT_SORT.LATEST),
  comment: todoCommentIdSchema.nullable().catch(null),
});
