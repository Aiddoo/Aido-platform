import { z } from 'zod';

/** 서버(1.13.0+)가 할 일 알림에 싣는 할 일 주인·날짜. 예전 알림에는 없다. */
const todoTargetShape = {
  todoOwnerId: z.string().min(1).optional().catch(undefined),
  todoDate: z.iso.date().optional().catch(undefined),
};

/** 구 필드(type·context·routing)로 목적지를 고를 때 타입마다 필요한 재료. 재료가 틀리면 이동하지 않는다 */
export const notificationDestinationRoutingSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TODO_SHARED'),
    todoId: z.int().positive(),
    commentId: z.cuid().optional().catch(undefined),
    ...todoTargetShape,
  }),
  z.object({ type: z.literal('FOLLOW_NEW') }),
  z.object({ type: z.literal('FOLLOW_ACCEPTED'), friendId: z.string() }),
  z.object({ type: z.literal('CHEER_RECEIVED'), friendId: z.string() }),
  z.object({ type: z.literal('FRIEND_COMPLETED'), friendId: z.string() }),
  z.object({
    type: z.literal('NUDGE_RECEIVED'),
    friendId: z.string().min(1).optional(),
    todoId: z.int().positive().optional(),
    nudgeId: z.int().positive().optional(),
    ...todoTargetShape,
  }),
  z.object({
    type: z.literal('NUDGE_REPLIED'),
    nudgeId: z.int().positive().optional(),
  }),
  z.object({
    type: z.literal('NUDGE_THANKED'),
    nudgeId: z.int().positive().optional(),
  }),
  z.object({
    type: z.literal('TODO_REMINDER'),
    todoId: z.int().positive().optional(),
    ...todoTargetShape,
  }),
  z.object({ type: z.literal('WEATHER_MORNING') }),
  z.object({ type: z.literal('WEATHER_EVENING') }),
  z.object({ type: z.literal('NUDGE_SUGGEST'), friendId: z.string() }),
  z.object({ type: z.literal('WEEKLY_ACHIEVEMENT') }),
  z.object({ type: z.literal('WEEKLY_REPORT') }),
  z.object({ type: z.literal('MONTHLY_REPORT') }),
  z.object({ type: z.literal('AI_SUGGESTION') }),
  z.object({ type: z.literal('PREMIUM_GRANT_ENDING') }),
  z.object({ type: z.literal('INVITE_JOINED') }),
  z.object({ type: z.literal('INVITE_REWARDED') }),
  z.object({ type: z.literal('INVITE_PROGRESS') }),
  z.object({ type: z.literal('FEED') }),
]);
export type NotificationDestinationRouting = z.infer<typeof notificationDestinationRoutingSchema>;
