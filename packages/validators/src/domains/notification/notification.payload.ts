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
  dispatchId: z.number().int().positive().optional(),
  campaignKey: z.string().max(100).optional(),
  variantId: z.string().max(100).optional(),
  purpose: z.enum(['TRANSACTIONAL', 'SCHEDULED_SERVICE', 'ENGAGEMENT']).optional(),
  marketingOptOutToken: z.string().max(2048).optional(),
});

export type PushNotificationData = z.infer<typeof pushNotificationDataSchema>;
