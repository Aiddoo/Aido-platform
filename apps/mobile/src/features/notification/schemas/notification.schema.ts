import {
  notificationActionSchema,
  notificationContextSchema,
  notificationInboxResponseSchema,
  notificationRoutingSchema,
  notificationTypeSchema,
  pushNotificationDataSchema,
} from '@aido/api';
import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORY);
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;

/** 알림함 항목 라벨을 나누는 분류 */
export type NotificationCategoryKey =
  | 'friend'
  | 'nudge'
  | 'cheer'
  | 'achievement'
  | 'todo'
  | 'reminder'
  | 'ai'
  | 'notice'
  | 'social';

export type NotificationContext = z.infer<typeof notificationContextSchema>;
export type NotificationRouting = z.infer<typeof notificationRoutingSchema>;
export type NotificationAction = z.infer<typeof notificationActionSchema>;

export const pushNotificationPayloadSchema = pushNotificationDataSchema.omit({
  dispatchId: true,
  navigation: true,
});
export type PushNotificationPayload = z.infer<typeof pushNotificationPayloadSchema>;

const notificationSchema = z.object({
  id: z.number(),
  userId: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  routing: notificationRoutingSchema.optional(),
  context: notificationContextSchema.optional(),
  action: notificationActionSchema.optional(),
  createdAt: instantSchema,
  readAt: instantSchema.nullable(),
});
export type Notification = z.infer<typeof notificationSchema>;

const notificationListResultSchema = notificationInboxResponseSchema
  .pick({ unreadCount: true, hasMore: true, nextCursor: true })
  .extend({ notifications: z.array(notificationSchema) });
export type NotificationListResult = z.infer<typeof notificationListResultSchema>;

export interface GetNotificationsQuery {
  limit?: number;
  cursor?: number;
  category?: NotificationCategory;
  unreadOnly?: boolean;
}

/** 서버(1.13.0+)가 할 일 알림에 싣는 할 일 주인·날짜. 예전 알림에는 없다. */
const todoTargetShape = {
  todoOwnerId: z.string().min(1).optional().catch(undefined),
  todoDate: z.iso.date().optional().catch(undefined),
};

/** 구 필드(type·context·routing)로 목적지를 고를 때 타입마다 필요한 재료. 재료가 틀리면 이동하지 않는다 */
export const notificationDestinationRoutingSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TODO_SHARED'),
    todoId: z.number().int().positive(),
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
    todoId: z.number().int().positive().optional(),
    nudgeId: z.number().int().positive().optional(),
    ...todoTargetShape,
  }),
  z.object({
    type: z.literal('NUDGE_REPLIED'),
    nudgeId: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('NUDGE_THANKED'),
    nudgeId: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('TODO_REMINDER'),
    todoId: z.number().int().positive().optional(),
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
