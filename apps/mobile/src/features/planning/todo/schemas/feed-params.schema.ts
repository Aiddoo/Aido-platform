import { dateSchema, TODO_COMMENT_SORT, todoCommentIdSchema, userIdParamSchema } from '@aido/api';
import { routeIdSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

/** `/feed` 한 화면의 URL 값. `?date` 없으면 오늘, `?friendId` 없으면 내 피드, `?comment`는 알림·링크로 연 댓글 위치다 */
export const feedParamsSchema = z.object({
  date: z
    .union([dateSchema, z.literal('today')])
    .optional()
    .catch(undefined),
  /** 다른 화면·위젯이 피드에 보낸 할 일 추가 요청. `add-voice-todo`는 시트를 열자마자 듣기를 시작한다 */
  action: z.enum(['add-todo', 'add-voice-todo']).optional().catch(undefined),
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
