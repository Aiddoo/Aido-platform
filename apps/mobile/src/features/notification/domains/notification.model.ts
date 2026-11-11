import { entityIdSchema, notificationTypeSchema } from '@aido/api/common';
import {
  NOTIFICATION_ACTION_TYPE,
  NOTIFICATION_CATEGORY,
  WEATHER_RESCHEDULE_REASONS,
} from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { z } from 'zod';

import { NOTIFICATION_TYPE_TRAITS } from '../constants/notification.constants';

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORY);

/** 할 일이 대상인 곳. 주인·날짜를 알면 펼친 화면이 목록 pane을 그 사람의 그 날짜 피드로 연다 */
const todoTargetShape = {
  todoId: z.int().positive(),
  ownerId: z.string().nullable(),
  dateKey: z.iso.date().nullable(),
};

/** 알림을 누르면 열 곳. 서버 navigation 종류와 1:1이고 칸은 앱이 쓰는 것만 둔다 */
export const notificationTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NONE') }),
  z.object({
    kind: z.literal('EXTERNAL_URL'),
    url: z.url({ protocol: /^https?$/ }),
    opensIn: z.enum([NOTIFICATION_ACTION_TYPE.BROWSER, NOTIFICATION_ACTION_TYPE.WEBVIEW]),
  }),
  z.object({ kind: z.literal('FEED') }),
  z.object({ kind: z.literal('FRIEND_FEED'), friendId: z.string() }),
  z.object({ kind: z.literal('FRIENDS') }),
  z.object({ kind: z.literal('FRIEND_REQUESTS') }),
  z.object({ kind: z.literal('TODO'), ...todoTargetShape }),
  z.object({ kind: z.literal('TODO_COMMENT'), ...todoTargetShape, commentId: entityIdSchema }),
  z.object({ kind: z.literal('NUDGE'), nudgeId: z.int().positive() }),
  z.object({ kind: z.literal('CHEER'), friendId: z.string() }),
  z.object({ kind: z.literal('WEATHER') }),
  z.object({
    kind: z.literal('WEATHER_RESCHEDULE'),
    todoIds: z.array(z.int().positive()).min(1),
    reason: z.enum(WEATHER_RESCHEDULE_REASONS),
  }),
  z.object({ kind: z.literal('ACHIEVEMENTS') }),
  z.object({ kind: z.literal('REPORTS') }),
  z.object({ kind: z.literal('SUGGESTIONS') }),
  z.object({ kind: z.literal('INVITE') }),
  z.object({ kind: z.literal('SUBSCRIPTION') }),
  z.object({ kind: z.literal('NOTIFICATIONS') }),
  z.object({ kind: z.literal('NOTIFICATION_SETTINGS') }),
]);
export type NotificationTarget = z.infer<typeof notificationTargetSchema>;

export const notificationSchema = z.object({
  id: z.int().positive(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  target: notificationTargetSchema,
  /** 신고할 수 있는 받은 응원. 응원 알림이 아니거나 응원 ID가 없으면 null이다 */
  receivedCheer: z
    .object({
      cheerId: z.int().positive(),
      senderId: z.string(),
      senderName: z.string().nullable(),
    })
    .nullable(),
  createdAt: instantSchema,
});
export type Notification = z.infer<typeof notificationSchema>;

const notificationPageSchema = cursorPageSchema(notificationSchema, z.number());
export type NotificationPage = z.infer<typeof notificationPageSchema>;

/** 읽음 응답으로 본 소유. 네트워크·5xx·예산 초과는 모르는 것이라 막지 않는다 */
export type NotificationOwnership = 'ok' | 'foreign' | 'unknown';

/** 프리미엄 AI 기능이 만든 알림. 열기 전에 기능 한도를 묻는다 */
function isAiFeature(notification: Notification) {
  return NOTIFICATION_TYPE_TRAITS[notification.type].isAiFeature;
}

function isUnread(notification: Notification) {
  return !notification.isRead;
}

/** 받은 알림(알림함 항목) */
export const NotificationPolicy = {
  isAiFeature,
  isUnread,
} as const;
