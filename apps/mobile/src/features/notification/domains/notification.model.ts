import {
  NOTIFICATION_ACTION_TYPE,
  NOTIFICATION_ACTIVITY_KIND,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_TYPE,
} from '@aido/api/vocabulary';
import type { AuthStatus } from '@src/bootstrap/providers/auth-provider';
import { z } from 'zod';

const notificationTypeSchema = z.enum(NOTIFICATION_TYPE);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORY);
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;

const notificationActionTypeSchema = z.enum(NOTIFICATION_ACTION_TYPE);

const notificationContextSchema = z.object({
  todoId: z.number().optional(),
  friendId: z.string().optional(),
  nudgeId: z.number().optional(),
  cheerId: z.number().optional(),
});
export type NotificationContext = z.infer<typeof notificationContextSchema>;

const notificationRoutingSchema = z.object({
  commentId: z.string().optional(),
  threadRootId: z.string().optional(),
  activityKind: z.enum(NOTIFICATION_ACTIVITY_KIND).optional(),
  senderId: z.string().optional(),
  senderName: z.string().optional(),
  todoOwnerId: z.string().optional(),
  todoDate: z.iso.date().optional(),
});
export type NotificationRouting = z.infer<typeof notificationRoutingSchema>;

const notificationActionSchema = z.object({
  type: notificationActionTypeSchema,
  url: z.string().optional(),
});
export type NotificationAction = z.infer<typeof notificationActionSchema>;

const pushNotificationPayloadSchema = z.object({
  notificationId: z.int().nonnegative(),
  type: notificationTypeSchema,
  action: notificationActionSchema,
  context: notificationContextSchema.optional(),
  routing: notificationRoutingSchema.optional(),
  campaignKey: z.string().optional(),
  variantId: z.string().optional(),
  purpose: z.enum(['TRANSACTIONAL', 'SCHEDULED_SERVICE', 'ENGAGEMENT']).optional(),
  marketingOptOutToken: z.string().optional(),
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
  createdAt: z.date(),
  readAt: z.date().nullable(),
});
export type Notification = z.infer<typeof notificationSchema>;

const notificationListResultSchema = z.object({
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

function isAiFeature(notification: Notification) {
  return AI_FEATURE_TYPES.has(notification.type);
}

/**
 * 받은 응원 알림이면 신고할 응원과 보낸 친구. 응원 ID가 없는 이전 알림은 신고할 대상을 알 수 없어 null.
 * 보낸 사람 이름은 1.13.0 서버부터 실리므로 이전 알림에는 없을 수 있다.
 */
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

export type NotificationResponseAction =
  | { status: 'process' }
  | {
      status: 'defer';
      reason: 'auth-resolving' | 'authentication-required' | 'navigation-not-ready';
    };

/** 푸시를 눌렀을 때 지금 처리할지 기다릴지. 공개 수신 거부 액션은 인증과 무관하게 처리한다. */
export function getResponseAction({
  authStatus,
  actionIdentifier,
  isNavigationReady = true,
}: {
  authStatus: AuthStatus;
  actionIdentifier: string;
  isNavigationReady?: boolean;
}): NotificationResponseAction {
  if (actionIdentifier === 'MARKETING_OPT_OUT') {
    return { status: 'process' };
  }
  if (authStatus === 'loading' || authStatus === 'locked') {
    return { status: 'defer', reason: 'auth-resolving' };
  }
  if (authStatus === 'unauthenticated') {
    return { status: 'defer', reason: 'authentication-required' };
  }
  if (!isNavigationReady) {
    return { status: 'defer', reason: 'navigation-not-ready' };
  }
  return { status: 'process' };
}

export const NotificationPolicy = {
  isAiFeature,
  findReceivedCheer,
  getResponseAction,
} as const;
