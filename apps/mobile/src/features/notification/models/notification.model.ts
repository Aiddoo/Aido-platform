import { NOTIFICATION_TYPE, type NotificationCategory } from '@aido/validators';
import { match } from 'ts-pattern';
import { z } from 'zod';

// ─── Schema & Type ───

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPE);
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

// ─── 순수 함수 (독립 테스트 가능) ───

/** 알림 카테고리 키 (표시 문구는 notification:categories.* 카탈로그) */
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

/** 알림 타입 → 카테고리 키 */
export const getCategoryKey = (type: NotificationType): NotificationCategoryKey =>
  match<NotificationType, NotificationCategoryKey>(type)
    .with('FOLLOW_NEW', 'FOLLOW_ACCEPTED', () => 'friend')
    .with('NUDGE_RECEIVED', () => 'nudge')
    .with('CHEER_RECEIVED', () => 'cheer')
    .with('DAILY_COMPLETE', 'FRIEND_COMPLETED', 'WEEKLY_ACHIEVEMENT', () => 'achievement')
    .with(
      'TODO_REMINDER',
      'TODO_SHARED',
      'WINBACK',
      'WEATHER_MORNING',
      'WEATHER_EVENING',
      () => 'todo',
    )
    .with('MORNING_REMINDER', 'EVENING_REMINDER', 'LUNCH_NUDGE', 'STREAK_AT_RISK', () => 'reminder')
    .with('WEEKLY_REPORT', 'MONTHLY_REPORT', 'AI_SUGGESTION', () => 'ai')
    .with('SYSTEM_NOTICE', 'ADMIN_BROADCAST', 'ADMIN_TARGETED', () => 'notice')
    .with('SOCIAL_DIGEST', 'NUDGE_SUGGEST', () => 'social')
    .exhaustive();

/** 알림 타입 + context → 앱 내부 라우트 */
export const getInternalRoute = (
  type: NotificationType,
  context?: Notification['context'],
): string | null =>
  match(type)
    .with('FOLLOW_NEW', () => '/friends?view=receiver')
    .with('FOLLOW_ACCEPTED', () =>
      context?.friendId ? `/feed/friend/${context.friendId}` : '/friends',
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
    .with(
      'WINBACK',
      'SOCIAL_DIGEST',
      'LUNCH_NUDGE',
      'STREAK_AT_RISK',
      'WEATHER_MORNING',
      'WEATHER_EVENING',
      () => '/feed',
    )
    .with('NUDGE_SUGGEST', () => (context?.friendId ? `/feed/friend/${context.friendId}` : '/feed'))
    .exhaustive();

// ─── Policy ───

const AI_FEATURE_TYPES: ReadonlySet<NotificationType> = new Set([
  'WEEKLY_REPORT',
  'MONTHLY_REPORT',
  'AI_SUGGESTION',
]);

export const NotificationPolicy = {
  /** 타입 → 카테고리 키 (기획 정의, 표시 문구는 카탈로그) */
  categoryKey(notification: Notification) {
    return getCategoryKey(notification.type);
  },

  /** 타입+context → 내부 라우트 (기획 정의) */
  internalRoute(notification: Notification) {
    return getInternalRoute(notification.type, notification.context);
  },

  /** AI 기능 알림인지 (기능 분류 규칙) */
  isAiFeature(notification: Notification) {
    return AI_FEATURE_TYPES.has(notification.type);
  },
};
