import { z } from 'zod';

import { NOTIFICATION_TYPE } from './notification.constants';

// =============================================================================
// Action Type
// =============================================================================

/**
 * 푸시 알림 액션 타입 (업계 표준)
 *
 * - DEEP_LINK: 앱 내부 라우팅
 * - BROWSER: 외부 브라우저로 URL 열기
 * - WEBVIEW: 인앱 브라우저로 URL 열기
 * - NONE: 액션 없음 (알림만 표시)
 */
export const NOTIFICATION_ACTION_TYPE = {
  DEEP_LINK: 'DEEP_LINK',
  BROWSER: 'BROWSER',
  WEBVIEW: 'WEBVIEW',
  NONE: 'NONE',
} as const;

export type NotificationActionType =
  (typeof NOTIFICATION_ACTION_TYPE)[keyof typeof NOTIFICATION_ACTION_TYPE];

export const notificationActionTypeSchema = z.enum([
  NOTIFICATION_ACTION_TYPE.DEEP_LINK,
  NOTIFICATION_ACTION_TYPE.BROWSER,
  NOTIFICATION_ACTION_TYPE.WEBVIEW,
  NOTIFICATION_ACTION_TYPE.NONE,
]);

// =============================================================================
// Context (라우팅에 필요한 ID들)
// =============================================================================

/**
 * 알림 라우팅에 필요한 컨텍스트 정보
 *
 * 클라이언트가 type + context 조합으로 라우트를 결정합니다.
 */
/**
 * 배포된 알림 목록 DTO에 그대로 박혀 있는 모양이라 필드를 늘리지 않는다.
 * 이동에 더 필요한 값은 notificationRoutingSchema가 따로 실어 나른다.
 */
export const notificationContextSchema = z.object({
  todoId: z.number().optional(),
  friendId: z.string().optional(),
  nudgeId: z.number().optional(),
  cheerId: z.number().optional(),
});

export type NotificationContext = z.infer<typeof notificationContextSchema>;

// =============================================================================
// Action (액션 타입 + URL)
// =============================================================================

/**
 * 푸시 알림 액션 정보
 *
 * - type: 액션 타입 (DEEP_LINK, BROWSER, WEBVIEW, NONE)
 * - url: DEEP_LINK의 경우 선택적, BROWSER/WEBVIEW의 경우 필수
 */
/**
 * 전용 컬럼이 없어 context에 담지 못하는 이동 재료.
 * REST에서는 metadata에, 푸시에서는 payload의 routing에 실린다 — 둘 다 구버전이 조용히 버린다.
 */
export const notificationRoutingSchema = z.object({
  commentId: z.cuid().optional(),
  threadRootId: z.cuid().optional(),
  activityKind: z.enum(['COMMENT', 'REPLY', 'LIKE']).optional(),
});

export type NotificationRouting = z.infer<typeof notificationRoutingSchema>;

export const notificationActionSchema = z.object({
  type: notificationActionTypeSchema,
  url: z.string().optional(),
});

export type NotificationAction = z.infer<typeof notificationActionSchema>;

// =============================================================================
// Push Payload (FCM/APNs data 필드)
// =============================================================================

const notificationTypes = Object.values(NOTIFICATION_TYPE) as [string, ...string[]];

/**
 * 푸시 알림 페이로드 스키마 (FCM/APNs data 필드)
 *
 * 서버에서 클라이언트로 전송되는 푸시 알림의 data 필드 구조입니다.
 */
export const pushNotificationDataSchema = z.object({
  notificationId: z.number().int().nonnegative(),
  type: z.enum(notificationTypes),
  action: notificationActionSchema,
  context: notificationContextSchema.optional(),
  routing: notificationRoutingSchema.optional(),
  dispatchId: z.number().int().positive().optional(),
  campaignKey: z.string().max(100).optional(),
  variantId: z.string().max(100).optional(),
  purpose: z.enum(['TRANSACTIONAL', 'SCHEDULED_SERVICE', 'ENGAGEMENT']).optional(),
  marketingOptOutToken: z.string().max(2048).optional(),
});

export type PushNotificationData = z.infer<typeof pushNotificationDataSchema>;
