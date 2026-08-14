import { z } from 'zod';

import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';

export const cheerSchema = z
  .object({
    id: z.number().int().positive().describe('응원 ID (양의 정수)'),
    senderId: z.cuid().describe('보낸 사용자 ID (CUID 25자)'),
    receiverId: z.cuid().describe('받은 사용자 ID (CUID 25자)'),
    message: z.string().max(200).nullable().describe('응원 메시지 (최대 200자, 미설정 시 null)'),
    createdAt: datetimeSchema.describe('생성 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z)'),
    readAt: nullableDatetimeSchema.describe(
      '읽은 시각 (ISO 8601 UTC, 예: 2026-01-17T10:30:00.000Z, 미읽음 시 null)',
    ),
  })
  .meta({
    example: {
      id: 1,
      senderId: 'clz7x5p8k0005qz0z8z8z8z8z',
      receiverId: 'clz7x5p8k0001qz0z8z8z8z8z',
      message: '오늘도 화이팅! 🎉',
      createdAt: '2026-01-17T10:00:00.000Z',
      readAt: null,
    },
  });

export type Cheer = z.infer<typeof cheerSchema>;

export const cheerSenderSchema = z
  .object({
    id: z.cuid().describe('사용자 ID (CUID 25자)'),
    userTag: z.string().length(8).describe('사용자 태그 (8자 영숫자 대문자, 예: JOHN2026)'),
    name: z.string().nullable().describe('사용자 이름 (미설정 시 null)'),
    profileImage: z.string().nullable().describe('프로필 이미지 URL (미설정 시 null)'),
  })
  .meta({
    example: {
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      userTag: 'JOHN2026',
      name: '존',
      profileImage: 'https://example.com/profiles/john.jpg',
    },
  });

export type CheerSender = z.infer<typeof cheerSenderSchema>;

export const cheerDetailSchema = cheerSchema
  .extend({
    sender: cheerSenderSchema,
  })
  .meta({
    example: {
      id: 1,
      senderId: 'clz7x5p8k0005qz0z8z8z8z8z',
      receiverId: 'clz7x5p8k0001qz0z8z8z8z8z',
      message: '오늘도 화이팅! 🎉',
      createdAt: '2026-01-17T10:00:00.000Z',
      readAt: null,
      sender: {
        id: 'clz7x5p8k0005qz0z8z8z8z8z',
        userTag: 'JOHN2026',
        name: '존',
        profileImage: 'https://example.com/profiles/john.jpg',
      },
    },
  });

export type CheerDetail = z.infer<typeof cheerDetailSchema>;

export const receivedCheersResponseSchema = z
  .object({
    cheers: z.array(cheerDetailSchema).describe('받은 응원 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 받은 응원 수 (음이 아닌 정수)'),
    unreadCount: z.number().int().nonnegative().describe('읽지 않은 응원 수 (음이 아닌 정수)'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .meta({
    example: {
      cheers: [
        {
          id: 1,
          senderId: 'clz7x5p8k0005qz0z8z8z8z8z',
          receiverId: 'clz7x5p8k0001qz0z8z8z8z8z',
          message: '오늘도 화이팅! 🎉',
          createdAt: '2026-01-17T10:00:00.000Z',
          readAt: null,
          sender: {
            id: 'clz7x5p8k0005qz0z8z8z8z8z',
            userTag: 'JOHN2026',
            name: '존',
            profileImage: 'https://example.com/profiles/john.jpg',
          },
        },
      ],
      totalCount: 5,
      unreadCount: 2,
      hasMore: false,
    },
  });

export type ReceivedCheersResponse = z.infer<typeof receivedCheersResponseSchema>;

export const sentCheersResponseSchema = z
  .object({
    cheers: z.array(cheerDetailSchema).describe('보낸 응원 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 보낸 응원 수 (음이 아닌 정수)'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .meta({
    example: {
      cheers: [
        {
          id: 2,
          senderId: 'clz7x5p8k0001qz0z8z8z8z8z',
          receiverId: 'clz7x5p8k0005qz0z8z8z8z8z',
          message: '같이 힘내요! 🔥',
          createdAt: '2026-01-16T15:00:00.000Z',
          readAt: '2026-01-16T16:00:00.000Z',
          sender: {
            id: 'clz7x5p8k0001qz0z8z8z8z8z',
            userTag: 'MATT2026',
            name: '매튜',
            profileImage: 'https://example.com/profiles/matthew.jpg',
          },
        },
      ],
      totalCount: 3,
      hasMore: false,
    },
  });

export type SentCheersResponse = z.infer<typeof sentCheersResponseSchema>;

export const createCheerResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    cheer: cheerSchema.describe('생성된 응원 정보'),
  })
  .meta({
    example: {
      message: '응원을 보냈습니다! 🎉',
      cheer: {
        id: 3,
        senderId: 'clz7x5p8k0001qz0z8z8z8z8z',
        receiverId: 'clz7x5p8k0005qz0z8z8z8z8z',
        message: '화이팅! 💪',
        createdAt: '2026-01-17T15:30:00.000Z',
        readAt: null,
      },
    },
  });

export type CreateCheerResponse = z.infer<typeof createCheerResponseSchema>;

export const markCheerReadResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    readCount: z.number().int().nonnegative().describe('읽음 처리된 응원 수 (음이 아닌 정수)'),
  })
  .meta({
    example: {
      message: '확인했습니다.',
      readCount: 3,
    },
  });

export type MarkCheerReadResponse = z.infer<typeof markCheerReadResponseSchema>;

export const cheerLimitInfoSchema = z
  .object({
    dailyLimit: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('일일 응원 제한 (음이 아닌 정수, 무제한 시 null)'),
    usedToday: z.number().int().nonnegative().describe('오늘 사용한 응원 수 (음이 아닌 정수)'),
    remainingToday: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('오늘 남은 응원 수 (음이 아닌 정수, 무제한 시 null)'),
    isUnlimited: z.boolean().describe('무제한 여부'),
  })
  .meta({
    example: {
      dailyLimit: 3,
      usedToday: 1,
      remainingToday: 2,
      isUnlimited: false,
    },
  });

export type CheerLimitInfo = z.infer<typeof cheerLimitInfoSchema>;

export const cheerCooldownInfoSchema = z
  .object({
    userId: z.cuid().describe('대상 사용자 ID (CUID 25자)'),
    canCheer: z.boolean().describe('응원 가능 여부'),
    cooldownEndsAt: nullableDatetimeSchema.describe(
      '쿨다운 종료 시각 (ISO 8601 UTC, 예: 2026-01-18T10:00:00.000Z, 쿨다운 없으면 null)',
    ),
    remainingSeconds: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('남은 쿨다운 시간 (초 단위, 음이 아닌 정수, 쿨다운 없으면 null)'),
  })
  .meta({
    example: {
      userId: 'clz7x5p8k0005qz0z8z8z8z8z',
      canCheer: false,
      cooldownEndsAt: '2026-01-18T10:00:00.000Z',
      remainingSeconds: 3600,
    },
  });

export type CheerCooldownInfo = z.infer<typeof cheerCooldownInfoSchema>;
