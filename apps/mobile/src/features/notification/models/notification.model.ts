import {
  notificationActionTypeSchema,
  notificationActivityKindSchema,
  notificationTypeSchema,
  type NotificationCategory,
  type NotificationType,
} from '@aido/validators';
import { z } from 'zod';

import { getCategoryKey } from './notification-category.model';

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

export interface GetNotificationsQuery {
  limit?: number;
  cursor?: number;
  category?: NotificationCategory;
  unreadOnly?: boolean;
}

const AI_FEATURE_TYPES: ReadonlySet<NotificationType> = new Set([
  'WEEKLY_REPORT',
  'MONTHLY_REPORT',
  'AI_SUGGESTION',
]);

export function categoryKey(notification: Notification) {
  return getCategoryKey(notification.type);
}

export function isAiFeature(notification: Notification) {
  return AI_FEATURE_TYPES.has(notification.type);
}

export const NotificationPolicy = {
  categoryKey,
  isAiFeature,
} as const;
