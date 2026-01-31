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
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.number(),
  userId: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  route: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.date(),
  readAt: z.date().nullable(),
});
export type Notification = z.infer<typeof notificationSchema>;

// 서버 응답용 스키마 (날짜가 string으로 옴)
export const serverNotificationSchema = z.object({
  id: z.number(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  route: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
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

export interface GetNotificationsQuery {
  limit?: number;
  cursor?: number;
  unreadOnly?: boolean;
}

export const NotificationPolicy = {
  isUnread: (notification: { isRead: boolean }): boolean => !notification.isRead,

  isActionable: (notification: { route: string | null }): boolean => notification.route !== null,

  hasExternalUrl: (notification: { metadata: Record<string, unknown> | null }): boolean =>
    typeof notification.metadata?.externalUrl === 'string',

  getExternalUrl: (notification: { metadata: Record<string, unknown> | null }): string | null =>
    typeof notification.metadata?.externalUrl === 'string'
      ? notification.metadata.externalUrl
      : null,
} as const;
