import { dateSchema, TODO_COMMENT_SORT, todoCommentIdSchema, userIdParamSchema } from '@aido/api';
import { routeIdSchema } from '@src/shared/utils/route-params';
import { z } from 'zod';

/**
 * `/feed` 한 화면의 URL 값. 내 피드와 친구 피드, 펼친 화면의 상세 칸이 모두 이 값으로 움직인다.
 * `?date` YYYY-MM-DD 또는 today, 나머지는 오늘이다. `?friendId` 없으면 내 피드, `?todoId` 상세 칸의 할 일,
 * `?sort`·`?comment` 그 할 일의 댓글 정렬과 알림·링크로 연 위치다.
 */
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
