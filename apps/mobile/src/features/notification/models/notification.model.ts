import {
  NOTIFICATION_ACTION_TYPE,
  NOTIFICATION_TYPE,
  type NotificationCategory,
} from '@aido/validators';
import { z } from 'zod';

import { getCategoryKey } from './notification-category.model';
import { resolveNotificationDestination } from './notification-destination.model';
import { toNotificationRouting } from './notification-routing.model';

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
  action: z
    .object({
      type: z.enum(NOTIFICATION_ACTION_TYPE),
      url: z.string().optional(),
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

  destination(notification: Notification) {
    return resolveNotificationDestination({
      type: notification.type,
      routing: toNotificationRouting({
        type: notification.type,
        context: notification.context,
        extra: notification.metadata ?? undefined,
      }),
      action: notification.action,
    });
  },

  /** AI 기능 알림인지 (기능 분류 규칙) */
  isAiFeature(notification: Notification) {
    return AI_FEATURE_TYPES.has(notification.type);
  },
};
