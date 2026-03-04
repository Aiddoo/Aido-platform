import { match } from 'ts-pattern';
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
  'WEEKLY_REPORT',
  'MONTHLY_REPORT',
  'AI_SUGGESTION',
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

// ─── 순수 함수 (primitive 입력 → primitive 출력) ───

export type NotificationContext = {
  todoId?: number;
  friendId?: string;
  nudgeId?: number;
  cheerId?: number;
};

/** 알림 타입 → 카테고리 라벨 */
const getCategoryLabel = (type: NotificationType): string =>
  match(type)
    .with('FOLLOW_NEW', 'FOLLOW_ACCEPTED', () => '친구')
    .with('NUDGE_RECEIVED', () => '콕 찌르기')
    .with('CHEER_RECEIVED', () => '응원')
    .with('DAILY_COMPLETE', 'FRIEND_COMPLETED', 'WEEKLY_ACHIEVEMENT', () => '달성')
    .with('TODO_REMINDER', 'TODO_SHARED', () => '할일')
    .with('MORNING_REMINDER', 'EVENING_REMINDER', () => '리마인더')
    .with('WEEKLY_REPORT', 'MONTHLY_REPORT', 'AI_SUGGESTION', () => 'AI')
    .with('SYSTEM_NOTICE', 'ADMIN_BROADCAST', 'ADMIN_TARGETED', () => '공지')
    .exhaustive();

/** 알림 타입 + context → 앱 내부 라우트 */
const getInternalRoute = (type: NotificationType, context?: NotificationContext): string | null =>
  match(type)
    .with('FOLLOW_NEW', () => '/friends')
    .with('FOLLOW_ACCEPTED', () =>
      context?.friendId ? `/feed/friend/${context.friendId}` : '/feed',
    )
    .with('CHEER_RECEIVED', 'FRIEND_COMPLETED', () =>
      context?.friendId ? `/feed/friend/${context.friendId}` : null,
    )
    .with('NUDGE_RECEIVED', () => (context?.friendId ? `/feed/friend/${context.friendId}` : null))
    .with(
      'TODO_REMINDER',
      'TODO_SHARED',
      'DAILY_COMPLETE',
      'MORNING_REMINDER',
      'EVENING_REMINDER',
      () => '/feed',
    )
    .with('WEEKLY_ACHIEVEMENT', () => '/achievements')
    .with('WEEKLY_REPORT', 'MONTHLY_REPORT', () => '/reports')
    .with('AI_SUGGESTION', () => '/suggestions')
    .with('SYSTEM_NOTICE', 'ADMIN_BROADCAST', 'ADMIN_TARGETED', () => null)
    .exhaustive();

// ─── Policy (비즈니스 로직의 유일한 거처) ───

const AI_FEATURE_TYPES: ReadonlySet<NotificationType> = new Set([
  'WEEKLY_REPORT',
  'MONTHLY_REPORT',
  'AI_SUGGESTION',
]);

export const NotificationPolicy = {
  isUnread: (notification: { isRead: boolean }): boolean => !notification.isRead,

  isAiFeature: (notification: { type: NotificationType }): boolean =>
    AI_FEATURE_TYPES.has(notification.type),

  hasExternalUrl: (notification: { metadata: Record<string, unknown> | null }): boolean =>
    typeof notification.metadata?.externalUrl === 'string',

  getExternalUrl: (notification: { metadata: Record<string, unknown> | null }): string | null =>
    typeof notification.metadata?.externalUrl === 'string'
      ? notification.metadata.externalUrl
      : null,

  categoryLabel: (notification: { type: NotificationType }): string =>
    getCategoryLabel(notification.type),

  internalRoute: (notification: {
    type: NotificationType;
    context?: NotificationContext;
  }): string | null => getInternalRoute(notification.type, notification.context),
} as const;
