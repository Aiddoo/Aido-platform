import {
  NOTIFICATION_ACTION_TYPE,
  NOTIFICATION_ACTIVITY_KIND,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_TYPE,
} from '@aido/api/vocabulary';
import type { AuthStatus } from '@src/core/session/auth-status';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { instantSchema } from '@src/shared/date/instant';
import { match } from 'ts-pattern';
import { z } from 'zod';

import {
  MARKETING_OPT_OUT_ACTION,
  NOTIFICATION_TYPE_TRAITS,
} from '../constants/notification.constants';
import type { PushNotificationPayload } from '../schemas/push-notification-payload.schema';

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPE);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORY);

export const notificationContextSchema = z.object({
  todoId: z.number().optional(),
  friendId: z.string().optional(),
  nudgeId: z.number().optional(),
  cheerId: z.number().optional(),
});
export type NotificationContext = z.infer<typeof notificationContextSchema>;

export const notificationRoutingSchema = z.object({
  commentId: z.string().optional(),
  threadRootId: z.string().optional(),
  activityKind: z.enum(NOTIFICATION_ACTIVITY_KIND).optional(),
  senderId: z.string().optional(),
  senderName: z.string().optional(),
  todoOwnerId: z.string().optional(),
  todoDate: z.string().optional(),
});
export type NotificationRouting = z.infer<typeof notificationRoutingSchema>;

export const notificationActionSchema = z.object({
  type: z.enum(NOTIFICATION_ACTION_TYPE),
  url: z.string().optional(),
});
export type NotificationAction = z.infer<typeof notificationActionSchema>;

export const notificationSchema = z.object({
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

export const notificationListResultSchema = z.object({
  notifications: z.array(notificationSchema),
  hasMore: z.boolean(),
  nextCursor: z.number().nullable(),
});
export type NotificationListResult = z.infer<typeof notificationListResultSchema>;

/** 읽음 응답으로 본 소유. 네트워크·5xx·예산 초과는 모르는 것이라 막지 않는다 */
export type NotificationOwnership = 'ok' | 'foreign' | 'unknown';

export interface PendingNotificationResponse {
  id: string;
  actionIdentifier: string;
  data: PushNotificationPayload;
  receivedAt: number;
}

const PENDING_RESPONSE_LIFETIME_MS = 10 * MINUTE_MS;

function isAiFeature(notification: Pick<Notification, 'type'>) {
  return NOTIFICATION_TYPE_TRAITS[notification.type].isAiFeature;
}

/** 받은 응원 알림이면 신고할 응원과 보낸 친구 */
function findReceivedCheer(
  notification: Pick<Notification, 'type' | 'context' | 'routing'>,
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

type NotificationResponseAction =
  | { type: 'optOut' }
  | { type: 'open' }
  | { type: 'defer'; reason: 'auth-resolving' | 'authentication-required' }
  | { type: 'drop'; reason: 'expired' };

function getResponseAction(
  response: Pick<PendingNotificationResponse, 'actionIdentifier' | 'receivedAt'>,
  { authStatus, now }: { authStatus: AuthStatus; now: number },
): NotificationResponseAction {
  if (now - response.receivedAt > PENDING_RESPONSE_LIFETIME_MS) {
    return { type: 'drop', reason: 'expired' };
  }
  if (response.actionIdentifier === MARKETING_OPT_OUT_ACTION) {
    return { type: 'optOut' };
  }
  return match(authStatus)
    .returnType<NotificationResponseAction>()
    .with('loading', 'locked', () => ({ type: 'defer', reason: 'auth-resolving' }))
    .with('unauthenticated', () => ({ type: 'defer', reason: 'authentication-required' }))
    .with('authenticated', () => ({ type: 'open' }))
    .exhaustive();
}

/** 알림 ID가 0이면 서버에 알림 기록이 없는 푸시라 읽음·열림을 서버에 묻지 않는다 */
function hasServerRecord({ notificationId }: Pick<PushNotificationPayload, 'notificationId'>) {
  return notificationId > 0;
}

export const NotificationPolicy = {
  hasServerRecord,
  isAiFeature,
  findReceivedCheer,
  getResponseAction,
} as const;
