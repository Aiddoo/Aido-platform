import { z } from 'zod';

export const notificationTypeSchema = z.enum([
  'FOLLOW_NEW',
  'FOLLOW_ACCEPTED',
  'NUDGE_RECEIVED',
  'CHEER_RECEIVED',
  'DAILY_COMPLETE',
  'FRIEND_COMPLETED',
  'TODO_REMINDER',
  'TODO_SHARED',
  'MORNING_REMINDER',
  'EVENING_REMINDER',
  'WEEKLY_ACHIEVEMENT',
  'SYSTEM_NOTICE',
  'ADMIN_BROADCAST',
  'ADMIN_TARGETED',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.number(),
  userId: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  context: z
    .object({
      todoId: z.number().optional(),
      friendId: z.string().optional(),
      nudgeId: z.number().optional(),
      cheerId: z.number().optional(),
    })
    .optional(),
  createdAt: z.date(),
  readAt: z.date().nullable(),
});
export type Notification = z.infer<typeof notificationSchema>;

// 서버 응답용 스키마 (날짜가 string으로 옴)
export const serverNotificationSchema = z.object({
  id: z.number(),
  userId: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  context: z
    .object({
      todoId: z.number().optional(),
      friendId: z.string().optional(),
      nudgeId: z.number().optional(),
      cheerId: z.number().optional(),
    })
    .optional(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
export type ServerNotification = z.infer<typeof serverNotificationSchema>;

export const notificationListResponseSchema = z.object({
  notifications: z.array(serverNotificationSchema),
  unreadCount: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.number().nullable(),
});
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;

export const notificationListResultSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.number().nullable(),
});
export type NotificationListResult = z.infer<typeof notificationListResultSchema>;

export const registerTokenResultSchema = z.object({
  message: z.string(),
  registered: z.boolean(),
});
export type RegisterTokenResult = z.infer<typeof registerTokenResultSchema>;

export const unreadCountResultSchema = z.object({
  unreadCount: z.number(),
});
export type UnreadCountResult = z.infer<typeof unreadCountResultSchema>;

export const markReadResultSchema = z.object({
  message: z.string(),
  readCount: z.number(),
});
export type MarkReadResult = z.infer<typeof markReadResultSchema>;

export const NOTIFICATION_CATEGORY = {
  ALL: 'ALL',
  NOTICE: 'NOTICE',
  TODO: 'TODO',
  SOCIAL: 'SOCIAL',
} as const;

export type NotificationCategory =
  (typeof NOTIFICATION_CATEGORY)[keyof typeof NOTIFICATION_CATEGORY];

export interface GetNotificationsQuery {
  limit?: number;
  cursor?: number;
  category?: NotificationCategory;
  unreadOnly?: boolean;
}

export const NotificationPolicy = {
  isUnread: (notification: { isRead: boolean }): boolean => !notification.isRead,

  hasExternalUrl: (notification: { metadata: Record<string, unknown> | null }): boolean =>
    typeof notification.metadata?.externalUrl === 'string',

  getExternalUrl: (notification: { metadata: Record<string, unknown> | null }): string | null =>
    typeof notification.metadata?.externalUrl === 'string'
      ? notification.metadata.externalUrl
      : null,
} as const;
