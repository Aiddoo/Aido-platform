import {
  entityIdSchema,
  notificationActionSchema,
  notificationContextSchema,
  notificationTypeSchema,
} from '@aido/api/common';
import {
  NOTIFICATION_ACTIVITY_KIND,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_TYPE,
} from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { z } from 'zod';

import { NOTIFICATION_TYPE_TRAITS } from '../constants/notification.constants';
import type { NotificationNavigation } from '../schemas/push-notification-payload.schema';

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORY);

export type NotificationContext = z.infer<typeof notificationContextSchema>;

const notificationRoutingSchema = z.object({
  commentId: z.string().optional(),
  threadRootId: z.string().optional(),
  activityKind: z.enum(NOTIFICATION_ACTIVITY_KIND).optional(),
  senderId: z.string().optional(),
  senderName: z.string().optional(),
  todoOwnerId: z.string().optional(),
  todoDate: z.string().optional(),
});
export type NotificationRouting = z.infer<typeof notificationRoutingSchema>;

export type NotificationAction = z.infer<typeof notificationActionSchema>;

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
    commentId: entityIdSchema.optional().catch(undefined),
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
  // 서버(1.15.1+)가 푸시와 같은 계산으로 고른 목적지. 옛 항목·옛 서버에는 없어 구 필드로 간다
  navigation: z.custom<NotificationNavigation>().optional(),
  createdAt: instantSchema,
  readAt: instantSchema.nullable(),
});
export type Notification = z.infer<typeof notificationSchema>;

const notificationPageSchema = cursorPageSchema(notificationSchema, z.number());
export type NotificationPage = z.infer<typeof notificationPageSchema>;

/** 읽음 응답으로 본 소유. 네트워크·5xx·예산 초과는 모르는 것이라 막지 않는다 */
export type NotificationOwnership = 'ok' | 'foreign' | 'unknown';

function isAiFeature(notification: Notification) {
  return NOTIFICATION_TYPE_TRAITS[notification.type].isAiFeature;
}

/** 응원 ID가 없는 이전 알림은 null이다. 보낸 사람 이름은 1.13.0 서버부터 실리므로 이전 알림에는 없을 수 있다 */
function findReceivedCheer(
  notification: Notification,
): { cheerId: number; senderId: string; senderName: string | null } | null {
  const cheerId = notification.context?.cheerId;
  const senderId = notification.context?.friendId;
  if (
    notification.type !== NOTIFICATION_TYPE.CHEER_RECEIVED ||
    cheerId == null ||
    senderId == null
  ) {
    return null;
  }
  return { cheerId, senderId, senderName: notification.routing?.senderName ?? null };
}

/** 받은 알림(알림함 항목) */
export const NotificationPolicy = {
  isAiFeature,
  findReceivedCheer,
} as const;
