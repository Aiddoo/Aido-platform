/**
 * Notification Response 스키마
 *
 * 알림 관련 응답 검증을 위한 Zod 스키마
 */
import { z } from 'zod';
import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';
import { NOTIFICATION_TYPE } from './notification.constants';

// ============================================
// 알림 엔티티
// ============================================

/** 알림 타입 스키마 */
export const notificationTypeSchema = z.enum([
  NOTIFICATION_TYPE.FOLLOW_NEW,
  NOTIFICATION_TYPE.FOLLOW_ACCEPTED,
  NOTIFICATION_TYPE.NUDGE_RECEIVED,
  NOTIFICATION_TYPE.CHEER_RECEIVED,
  NOTIFICATION_TYPE.DAILY_COMPLETE,
  NOTIFICATION_TYPE.FRIEND_COMPLETED,
  NOTIFICATION_TYPE.TODO_REMINDER,
  NOTIFICATION_TYPE.TODO_SHARED,
  NOTIFICATION_TYPE.MORNING_REMINDER,
  NOTIFICATION_TYPE.EVENING_REMINDER,
  NOTIFICATION_TYPE.WEEKLY_ACHIEVEMENT,
  NOTIFICATION_TYPE.SYSTEM_NOTICE,
]);

/** 알림 정보 스키마 */
export const notificationSchema = z
  .object({
    id: z.number().int().positive().describe('알림 고유 ID'),
    userId: z.string().describe('수신자 ID'),
    type: notificationTypeSchema.describe('알림 타입'),
    title: z.string().max(200).describe('알림 제목'),
    body: z.string().max(500).describe('알림 내용'),
    isRead: z.boolean().describe('읽음 여부'),
    route: z.string().max(200).nullable().describe('인앱 라우팅 경로'),
    metadata: z.record(z.string(), z.unknown()).nullable().describe('추가 메타데이터 (JSON)'),
    createdAt: datetimeSchema.describe('생성 시각'),
    readAt: nullableDatetimeSchema.describe('읽음 시각 (미확인 시 null)'),
  })
  .describe('알림 정보')
  .meta({
    example: {
      id: 1,
      userId: 'clz7x5p8k0001qz0z8z8z8z8z',
      type: 'NUDGE_RECEIVED',
      title: '친구의 응원이 도착했어요!',
      body: '존님이 당신의 할일을 응원하고 있어요 💪',
      isRead: false,
      route: '/friends/clz7x5p8k0005qz0z8z8z8z8z',
      metadata: { senderId: 'clz7x5p8k0005qz0z8z8z8z8z' },
      createdAt: '2026-01-17T10:00:00.000Z',
      readAt: null,
    },
  });

export type Notification = z.infer<typeof notificationSchema>;

// ============================================
// 알림 목록 응답
// ============================================

/** 알림 목록 응답 */
export const notificationListResponseSchema = z
  .object({
    notifications: z.array(notificationSchema).describe('알림 목록'),
    unreadCount: z.number().int().nonnegative().describe('읽지 않은 알림 수'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
    nextCursor: z.number().int().positive().nullable().describe('다음 페이지 커서'),
  })
  .describe('알림 목록 응답')
  .meta({
    example: {
      notifications: [
        {
          id: 1,
          userId: 'clz7x5p8k0001qz0z8z8z8z8z',
          type: 'NUDGE_RECEIVED',
          title: '친구의 응원이 도착했어요!',
          body: '존님이 당신의 할일을 응원하고 있어요 💪',
          isRead: false,
          route: '/friends/clz7x5p8k0005qz0z8z8z8z8z',
          metadata: { senderId: 'clz7x5p8k0005qz0z8z8z8z8z' },
          createdAt: '2026-01-17T10:00:00.000Z',
          readAt: null,
        },
      ],
      unreadCount: 3,
      hasMore: true,
      nextCursor: 2,
    },
  });

export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;

// ============================================
// 읽지 않은 알림 수 응답
// ============================================

/** 읽지 않은 알림 수 응답 */
export const unreadCountResponseSchema = z
  .object({
    unreadCount: z.number().int().nonnegative().describe('읽지 않은 알림 수'),
  })
  .describe('읽지 않은 알림 수 응답')
  .meta({
    example: {
      unreadCount: 5,
    },
  });

export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;

// ============================================
// 푸시 토큰 등록 응답
// ============================================

/** 푸시 토큰 등록 응답 */
export const registerTokenResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    registered: z.boolean().describe('등록 성공 여부'),
  })
  .describe('푸시 토큰 등록 응답')
  .meta({
    example: {
      message: '푸시 토큰이 등록되었습니다.',
      registered: true,
    },
  });

export type RegisterTokenResponse = z.infer<typeof registerTokenResponseSchema>;

// ============================================
// 알림 읽음 처리 응답
// ============================================

/** 알림 읽음 처리 응답 */
export const markReadResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    readCount: z.number().int().nonnegative().describe('읽음 처리된 알림 수'),
  })
  .describe('알림 읽음 처리 응답')
  .meta({
    example: {
      message: '알림을 읽음 처리했습니다.',
      readCount: 3,
    },
  });

export type MarkReadResponse = z.infer<typeof markReadResponseSchema>;
