/**
 * Cheer Response 스키마
 *
 * 응원 관련 응답 검증을 위한 Zod 스키마
 */
import { z } from 'zod';
import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';

// ============================================
// 응원 엔티티
// ============================================

/** 응원 정보 스키마 */
export const cheerSchema = z
  .object({
    id: z.number().int().positive().describe('응원 고유 ID'),
    senderId: z.string().cuid().describe('보낸 사람 ID'),
    receiverId: z.string().cuid().describe('받은 사람 ID'),
    message: z.string().max(200).nullable().describe('응원 메시지'),
    createdAt: datetimeSchema.describe('보낸 시각'),
    readAt: nullableDatetimeSchema.describe('확인 시각 (미확인 시 null)'),
  })
  .describe('응원 정보')
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

// ============================================
// 응원 상세 정보 (관계 포함)
// ============================================

/** 응원 보낸 친구 정보 */
export const cheerSenderSchema = z
  .object({
    id: z.string().cuid().describe('친구 ID'),
    userTag: z.string().length(8).describe('친구 태그'),
    name: z.string().nullable().describe('친구 이름'),
    profileImage: z.string().nullable().describe('친구 프로필 이미지'),
  })
  .describe('응원 보낸 친구 정보')
  .meta({
    example: {
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      userTag: 'JOHN2026',
      name: '존',
      profileImage: 'https://example.com/profiles/john.jpg',
    },
  });

export type CheerSender = z.infer<typeof cheerSenderSchema>;

/** 응원 상세 정보 (친구 포함) */
export const cheerDetailSchema = cheerSchema
  .extend({
    sender: cheerSenderSchema.describe('보낸 친구 정보'),
  })
  .describe('응원 상세 정보')
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

// ============================================
// 응원 목록 응답
// ============================================

/** 받은 응원 목록 응답 */
export const receivedCheersResponseSchema = z
  .object({
    cheers: z.array(cheerDetailSchema).describe('받은 응원 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 받은 응원 수'),
    unreadCount: z.number().int().nonnegative().describe('아직 확인 안 한 응원 수'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .describe('받은 응원 목록 응답')
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

/** 보낸 응원 목록 응답 */
export const sentCheersResponseSchema = z
  .object({
    cheers: z.array(cheerDetailSchema).describe('보낸 응원 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 보낸 응원 수'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .describe('보낸 응원 목록 응답')
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

// ============================================
// 응원 보내기 액션 응답
// ============================================

/** 응원 보내기 성공 응답 */
export const createCheerResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    cheer: cheerSchema.describe('생성된 응원'),
  })
  .describe('응원 보내기 성공 응답')
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

/** 응원 확인 응답 */
export const markCheerReadResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    readCount: z.number().int().nonnegative().describe('확인 처리된 응원 수'),
  })
  .describe('응원 확인 응답')
  .meta({
    example: {
      message: '확인했습니다.',
      readCount: 3,
    },
  });

export type MarkCheerReadResponse = z.infer<typeof markCheerReadResponseSchema>;

// ============================================
// 응원 제한 정보
// ============================================

/** 일일 응원 제한 정보 */
export const cheerLimitInfoSchema = z
  .object({
    dailyLimit: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('하루 제한 횟수 (null = 무제한)'),
    usedToday: z.number().int().nonnegative().describe('오늘 보낸 횟수'),
    remainingToday: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('오늘 남은 횟수 (null = 무제한)'),
    isUnlimited: z.boolean().describe('무제한 여부 (프리미엄)'),
  })
  .describe('일일 응원 제한 정보')
  .meta({
    example: {
      dailyLimit: 3,
      usedToday: 1,
      remainingToday: 2,
      isUnlimited: false,
    },
  });

export type CheerLimitInfo = z.infer<typeof cheerLimitInfoSchema>;

// ============================================
// 쿨다운 정보
// ============================================

/** 특정 사용자에 대한 쿨다운 정보 */
export const cheerCooldownInfoSchema = z
  .object({
    userId: z.string().cuid().describe('대상 사용자 ID'),
    canCheer: z.boolean().describe('응원 가능 여부'),
    cooldownEndsAt: nullableDatetimeSchema.describe('쿨다운 종료 시각 (가능하면 null)'),
    remainingSeconds: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('남은 쿨다운 시간 (초, 가능하면 null)'),
  })
  .describe('특정 사용자에 대한 쿨다운 정보')
  .meta({
    example: {
      userId: 'clz7x5p8k0005qz0z8z8z8z8z',
      canCheer: false,
      cooldownEndsAt: '2026-01-18T10:00:00.000Z',
      remainingSeconds: 3600,
    },
  });

export type CheerCooldownInfo = z.infer<typeof cheerCooldownInfoSchema>;
