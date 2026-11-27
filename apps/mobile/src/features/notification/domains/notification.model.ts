import { entityIdSchema, notificationTypeSchema } from '@aido/api/common';
import {
  NOTIFICATION_ACTION_TYPE,
  NOTIFICATION_CATEGORY,
  WEATHER_RESCHEDULE_REASONS,
} from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { z } from 'zod';

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORY);

/** 할 일이 대상인 곳. 주인·날짜를 알면 펼친 화면이 목록 pane을 그 사람의 그 날짜 피드로 연다 */
const todoTargetShape = {
  todoId: z.int().positive(),
  ownerId: z.string().nullable(),
  dateKey: dateKeySchema.nullable(),
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

/** 앱이 켜진 동안 받으면 다시 받을 다른 기능의 데이터. 없으면 null */
export type NotificationReceiptRefresh = 'nudge-interactions' | 'friends' | 'invite' | 'me' | null;

interface NotificationTypeRule {
  /** 프리미엄 AI 기능이 만든 알림. 열기 전에 기능 한도를 묻는다 */
  isAiFeature: boolean;
  refreshOnReceipt: NotificationReceiptRefresh;
}

/** 알림 종류마다의 업무 규칙. 서버가 종류를 더하면 여기서 한 줄을 정해야 빌드가 된다(라벨은 view-model) */
const NOTIFICATION_TYPE_RULES = {
  FOLLOW_NEW: { isAiFeature: false, refreshOnReceipt: 'friends' },
  FOLLOW_ACCEPTED: { isAiFeature: false, refreshOnReceipt: 'friends' },
  INVITE_JOINED: { isAiFeature: false, refreshOnReceipt: 'invite' },
  INVITE_REWARDED: { isAiFeature: false, refreshOnReceipt: 'invite' },
  INVITE_PROGRESS: { isAiFeature: false, refreshOnReceipt: 'invite' },
  INVITE_QUALIFY_REMINDER: { isAiFeature: false, refreshOnReceipt: null },
  NUDGE_RECEIVED: { isAiFeature: false, refreshOnReceipt: 'nudge-interactions' },
  NUDGE_REPLIED: { isAiFeature: false, refreshOnReceipt: 'nudge-interactions' },
  NUDGE_THANKED: { isAiFeature: false, refreshOnReceipt: 'nudge-interactions' },
  CHEER_RECEIVED: { isAiFeature: false, refreshOnReceipt: null },
  DAILY_COMPLETE: { isAiFeature: false, refreshOnReceipt: null },
  FRIEND_COMPLETED: { isAiFeature: false, refreshOnReceipt: null },
  WEEKLY_ACHIEVEMENT: { isAiFeature: false, refreshOnReceipt: null },
  TODO_REMINDER: { isAiFeature: false, refreshOnReceipt: null },
  TODO_SHARED: { isAiFeature: false, refreshOnReceipt: null },
  WINBACK: { isAiFeature: false, refreshOnReceipt: null },
  WEATHER_MORNING: { isAiFeature: false, refreshOnReceipt: null },
  WEATHER_EVENING: { isAiFeature: false, refreshOnReceipt: null },
  MORNING_REMINDER: { isAiFeature: false, refreshOnReceipt: null },
  EVENING_REMINDER: { isAiFeature: false, refreshOnReceipt: null },
  LUNCH_NUDGE: { isAiFeature: false, refreshOnReceipt: null },
  STREAK_AT_RISK: { isAiFeature: false, refreshOnReceipt: null },
  WEEKLY_REPORT: { isAiFeature: true, refreshOnReceipt: null },
  MONTHLY_REPORT: { isAiFeature: true, refreshOnReceipt: null },
  AI_SUGGESTION: { isAiFeature: true, refreshOnReceipt: null },
  SYSTEM_NOTICE: { isAiFeature: false, refreshOnReceipt: null },
  ADMIN_BROADCAST: { isAiFeature: false, refreshOnReceipt: null },
  ADMIN_TARGETED: { isAiFeature: false, refreshOnReceipt: null },
  // 보상 기간이 곧 끝난다는 알림이면 구독 화면의 남은 기간을 서버 값으로 맞춘다
  PREMIUM_GRANT_ENDING: { isAiFeature: false, refreshOnReceipt: 'me' },
  SOCIAL_DIGEST: { isAiFeature: false, refreshOnReceipt: null },
  NUDGE_SUGGEST: { isAiFeature: false, refreshOnReceipt: null },
} as const satisfies Record<NotificationType, NotificationTypeRule>;

/** 받은 푸시 종류가 바꾸는 다른 기능의 데이터. 받을 때 다시 받으면 보고 있는 화면에 새 내용이 바로 보인다 */
export function getNotificationReceiptRefresh(type: NotificationType): NotificationReceiptRefresh {
  return NOTIFICATION_TYPE_RULES[type].refreshOnReceipt;
}

/** 받은 알림(알림함 항목) */
export const NotificationPolicy = {
  /** 프리미엄 AI 기능이 만든 알림. 열기 전에 기능 한도를 묻는다 */
  isAiFeature(notification: Notification): boolean {
    return NOTIFICATION_TYPE_RULES[notification.type].isAiFeature;
  },

  isUnread(notification: Notification): boolean {
    return !notification.isRead;
  },
};
