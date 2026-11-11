import { notificationContextSchema, notificationTypeSchema } from '@aido/api/common';
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

const notificationSchema = z.object({
  id: z.number(),
  userId: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  routing: notificationRoutingSchema.optional(),
  context: notificationContextSchema.optional(),
  // 서버가 푸시와 같은 계산으로 고른 목적지. 계산하지 못한 행에는 없어 알림함으로 연다
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
