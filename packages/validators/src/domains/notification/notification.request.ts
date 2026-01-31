import { z } from 'zod';
import { EXPO_PUSH_TOKEN_REGEX, NOTIFICATION_LIMITS } from './notification.constants';

export const registerPushTokenSchema = z.object({
  token: z
    .string()
    .min(1, '푸시 토큰이 필요합니다')
    .max(NOTIFICATION_LIMITS.MAX_PUSH_TOKEN_LENGTH, '푸시 토큰이 너무 깁니다')
    .regex(EXPO_PUSH_TOKEN_REGEX, '유효하지 않은 Expo 푸시 토큰 형식입니다')
    .describe('Expo 푸시 토큰 (ExponentPushToken[...] 형식)'),
  deviceId: z
    .string()
    .min(1, '기기 ID가 필요합니다')
    .max(100, '기기 ID가 너무 깁니다')
    .optional()
    .describe('기기 식별자 (선택, 최대 100자)'),
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

export const markNotificationReadSchema = z.object({
  notificationId: z.coerce
    .number()
    .int()
    .positive('유효하지 않은 알림 ID입니다')
    .describe('알림 ID (양의 정수)'),
});

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;

export const markNotificationsReadSchema = z.object({
  notificationIds: z
    .array(z.coerce.number().int().positive('유효하지 않은 알림 ID입니다'))
    .min(1, '최소 1개의 알림 ID가 필요합니다')
    .max(100, '한 번에 최대 100개까지 처리 가능합니다')
    .describe('알림 ID 배열 (1-100개, 양의 정수)'),
});

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

export const getNotificationsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1, '최소 1개 이상 조회해야 합니다')
    .max(
      NOTIFICATION_LIMITS.MAX_FETCH_LIMIT,
      `최대 ${NOTIFICATION_LIMITS.MAX_FETCH_LIMIT}개까지 조회 가능합니다`,
    )
    .default(NOTIFICATION_LIMITS.DEFAULT_FETCH_LIMIT)
    .describe('조회할 알림 개수 (1-100, 기본값: 20)'),
  cursor: z.coerce
    .number()
    .int()
    .positive('유효하지 않은 커서입니다')
    .optional()
    .describe('페이지네이션 커서 (선택, 양의 정수)'),
  unreadOnly: z.coerce
    .boolean()
    .default(false)
    .describe('읽지 않은 알림만 조회 여부 (기본값: false)'),
});

export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;
