import {
  NOTIFICATION_TYPE,
  notificationActionTypeSchema,
  notificationActivityKindSchema,
  notificationTypeSchema,
  getNotificationsQuerySchema,
  type NotificationType,
} from '@aido/api';
import { z } from 'zod';

export const notificationSchema = z.object({
  id: z.number(),
  userId: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  routing: z
    .object({
      commentId: z.string().optional(),
      threadRootId: z.string().optional(),
      activityKind: notificationActivityKindSchema.optional(),
    })
    .optional(),
  context: z
    .object({
      todoId: z.number().optional(),
      friendId: z.string().optional(),
      nudgeId: z.number().optional(),
      cheerId: z.number().optional(),
    })
    .optional(),
  action: z.object({ type: notificationActionTypeSchema, url: z.string().optional() }).optional(),
  createdAt: z.date(),
  readAt: z.date().nullable(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationListResultSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.number().nullable(),
});
export type NotificationListResult = z.infer<typeof notificationListResultSchema>;

const notificationsQueryInputSchema = getNotificationsQuerySchema.partial();
export type GetNotificationsQuery = z.infer<typeof notificationsQueryInputSchema>;

const AI_FEATURE_TYPES: ReadonlySet<NotificationType> = new Set([
  'WEEKLY_REPORT',
  'MONTHLY_REPORT',
  'AI_SUGGESTION',
]);

export function isAiFeature(notification: Notification) {
  return AI_FEATURE_TYPES.has(notification.type);
}

/** 받은 응원 알림이면 신고할 응원과 보낸 친구. 응원 ID가 없는 이전 알림은 신고할 대상을 알 수 없어 null */
export function findReceivedCheer(
  notification: Notification,
): { cheerId: number; senderId: string } | null {
  const cheerId = notification.context?.cheerId;
  const senderId = notification.context?.friendId;
  if (
    notification.type !== NOTIFICATION_TYPE.CHEER_RECEIVED ||
    cheerId == null ||
    senderId == null
  ) {
    return null;
  }
  return { cheerId, senderId };
}

export const NotificationPolicy = {
  isAiFeature,
  findReceivedCheer,
} as const;
