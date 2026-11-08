import { dateSchema, TODO_COMMENT_SORT, todoCommentIdSchema, userIdParamSchema } from '@aido/api';
import { routeIdSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

/** `/feed` 한 화면의 URL 값. `?date` 없으면 오늘, `?friendId` 없으면 내 피드, `?comment`는 알림·링크로 연 댓글 위치다 */
export const feedParamsSchema = z.object({
  date: z
    .union([dateSchema, z.literal('today')])
    .optional()
    .catch(undefined),
  action: z.literal('add-todo').optional().catch(undefined),
  friendId: userIdParamSchema.shape.userId.optional().catch(undefined),
  todoId: routeIdSchema.optional().catch(undefined),
  sort: z.enum(TODO_COMMENT_SORT).catch(TODO_COMMENT_SORT.LATEST),
  comment: todoCommentIdSchema.optional().catch(undefined),
});

type FeedParams = z.output<typeof feedParamsSchema>;

export type FeedDateParam = FeedParams['date'];

/** 고른 할 일에 딸린 URL 값. 할 일이나 친구가 바뀌면 이 값들을 함께 지운다 */
export const CLEARED_TODO_SELECTION = {
  todoId: undefined,
  comment: undefined,
  sort: undefined,
} satisfies Partial<FeedParams>;
