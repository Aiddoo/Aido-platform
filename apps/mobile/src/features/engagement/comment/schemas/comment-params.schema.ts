import { todoCommentIdSchema } from '@aido/api';
import { feedParamsSchema } from '@src/features/planning/todo/schemas/feed-params.schema';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';

/** 할 일 상세의 URL 상태. 정렬과 알림·링크로 연 댓글 위치만 둔다. 없거나 잘못된 값은 최신순·위치 없음이다 */
export const commentParamsSchema = feedParamsSchema.pick({ sort: true, comment: true });

/** 1.14.0 이하 대화 링크의 경로 값 */
export const legacyTodoCommentThreadParamsSchema = todoParamsSchema.extend({
  commentId: todoCommentIdSchema,
});
