import { z } from 'zod';
import { datetimeOutputSchema, nullableDatetimeOutputSchema } from '../../common/datetime';
import { NOTIFICATION_TYPE } from './notification.constants';

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

export const notificationSchema = z
  .object({
    id: z.number().int().positive().describe('알림 ID (양의 정수)'),
    userId: z.string().describe('사용자 ID (CUID 25자)'),
    type: notificationTypeSchema.describe(
      '알림 타입 (FOLLOW_NEW | FOLLOW_ACCEPTED | NUDGE_RECEIVED | CHEER_RECEIVED 등)',
    ),
    title: z.string().max(200).describe('알림 제목 (최대 200자)'),
    body: z.string().max(500).describe('알림 본문 (최대 500자)'),
    isRead: z.boolean().describe('읽음 여부'),
    route: z.string().max(200).nullable().describe('라우트 경로 (최대 200자, 미설정 시 null)'),
    metadata: z
      .record(z.string(), z.unknown())
      .nullable()
      .describe('추가 메타데이터 (미설정 시 null)'),
    createdAt: datetimeOutputSchema.describe(
      '생성 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z)',
    ),
    readAt: nullableDatetimeOutputSchema.describe(
      '읽은 시각 (ISO 8601 UTC, 예: 2026-01-17T10:30:00.000Z, 미읽음 시 null)',
    ),
  })
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

export const notificationListResponseSchema = z
  .object({
    notifications: z.array(notificationSchema).describe('알림 목록'),
    unreadCount: z.number().int().nonnegative().describe('읽지 않은 알림 수 (음이 아닌 정수)'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
    nextCursor: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe('다음 커서 (양의 정수, 마지막 페이지는 null)'),
  })
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

export const unreadCountResponseSchema = z
  .object({
    unreadCount: z.number().int().nonnegative().describe('읽지 않은 알림 수 (음이 아닌 정수)'),
  })
  .meta({
    example: {
      unreadCount: 5,
    },
  });

export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;

export const registerTokenResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    registered: z.boolean().describe('토큰 등록 성공 여부'),
  })
  .meta({
    example: {
      message: '푸시 토큰이 등록되었습니다.',
      registered: true,
    },
  });

export type RegisterTokenResponse = z.infer<typeof registerTokenResponseSchema>;

export const markReadResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    readCount: z.number().int().nonnegative().describe('읽음 처리된 알림 수 (음이 아닌 정수)'),
  })
  .meta({
    example: {
      message: '알림을 읽음 처리했습니다.',
      readCount: 3,
    },
  });

export type MarkReadResponse = z.infer<typeof markReadResponseSchema>;
