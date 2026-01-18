/**
 * Nudge Response 스키마
 *
 * 콕 찌르기 관련 응답 검증을 위한 Zod 스키마
 */
import { z } from 'zod';
import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';

// ============================================
// 콕 찌름 엔티티
// ============================================

/** 콕 찌름 정보 스키마 */
export const nudgeSchema = z
  .object({
    id: z.number().int().positive().describe('콕 찌름 고유 ID'),
    senderId: z.string().cuid().describe('찌른 사람 ID'),
    receiverId: z.string().cuid().describe('찔린 사람 ID'),
    todoId: z.number().int().positive().describe('관련 할 일 ID'),
    message: z.string().max(200).nullable().describe('응원 메시지'),
    createdAt: datetimeSchema.describe('찌른 시각'),
    readAt: nullableDatetimeSchema.describe('확인 시각 (미확인 시 null)'),
  })
  .describe('콕 찌름 정보')
  .meta({
    example: {
      id: 1,
      senderId: 'clz7x5p8k0005qz0z8z8z8z8z',
      receiverId: 'clz7x5p8k0001qz0z8z8z8z8z',
      todoId: 1,
      message: '오늘 할 일 잊지 마세요! 💪',
      createdAt: '2026-01-17T10:00:00.000Z',
      readAt: null,
    },
  });

export type Nudge = z.infer<typeof nudgeSchema>;

// ============================================
// 콕 찌름 상세 정보 (관계 포함)
// ============================================

/** 콕 찌른 친구 정보 */
export const nudgeSenderSchema = z
  .object({
    id: z.string().cuid().describe('친구 ID'),
    name: z.string().nullable().describe('친구 이름'),
    profileImage: z.string().nullable().describe('친구 프로필 이미지'),
  })
  .describe('콕 찌른 친구 정보')
  .meta({
    example: {
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      name: '존',
      profileImage: 'https://example.com/profiles/john.jpg',
    },
  });

export type NudgeSender = z.infer<typeof nudgeSenderSchema>;

/** 찔러준 할 일 정보 (간략) */
export const nudgeTodoSchema = z
  .object({
    id: z.number().int().positive().describe('할 일 ID'),
    title: z.string().max(200).describe('할 일 제목'),
    completed: z.boolean().describe('완료 여부'),
  })
  .describe('찔러준 할 일 정보')
  .meta({
    example: {
      id: 1,
      title: '운동하기',
      completed: false,
    },
  });

export type NudgeTodo = z.infer<typeof nudgeTodoSchema>;

/** 콕 찌름 상세 정보 (친구 + 할 일 포함) */
export const nudgeDetailSchema = nudgeSchema
  .extend({
    sender: nudgeSenderSchema.describe('찌른 친구 정보'),
    todo: nudgeTodoSchema.describe('관련 할 일 정보'),
  })
  .describe('콕 찌름 상세 정보')
  .meta({
    example: {
      id: 1,
      senderId: 'clz7x5p8k0005qz0z8z8z8z8z',
      receiverId: 'clz7x5p8k0001qz0z8z8z8z8z',
      todoId: 1,
      message: '오늘 할 일 잊지 마세요! 💪',
      createdAt: '2026-01-17T10:00:00.000Z',
      readAt: null,
      sender: {
        id: 'clz7x5p8k0005qz0z8z8z8z8z',
        name: '존',
        profileImage: 'https://example.com/profiles/john.jpg',
      },
      todo: {
        id: 1,
        title: '운동하기',
        completed: false,
      },
    },
  });

export type NudgeDetail = z.infer<typeof nudgeDetailSchema>;

// ============================================
// 콕 찌름 목록 응답
// ============================================

/** 받은 콕 찌름 목록 응답 */
export const receivedNudgesResponseSchema = z
  .object({
    nudges: z.array(nudgeDetailSchema).describe('받은 콕 찌름 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 받은 콕 찌름 수'),
    unreadCount: z.number().int().nonnegative().describe('아직 확인 안 한 콕 찌름 수'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .describe('받은 콕 찌름 목록 응답')
  .meta({
    example: {
      nudges: [
        {
          id: 1,
          senderId: 'clz7x5p8k0005qz0z8z8z8z8z',
          receiverId: 'clz7x5p8k0001qz0z8z8z8z8z',
          todoId: 1,
          message: '오늘 할 일 잊지 마세요! 💪',
          createdAt: '2026-01-17T10:00:00.000Z',
          readAt: null,
          sender: {
            id: 'clz7x5p8k0005qz0z8z8z8z8z',
            name: '존',
            profileImage: 'https://example.com/profiles/john.jpg',
          },
          todo: {
            id: 1,
            title: '운동하기',
            completed: false,
          },
        },
      ],
      totalCount: 5,
      unreadCount: 2,
      hasMore: false,
    },
  });

export type ReceivedNudgesResponse = z.infer<typeof receivedNudgesResponseSchema>;

/** 보낸 콕 찌름 목록 응답 */
export const sentNudgesResponseSchema = z
  .object({
    nudges: z.array(nudgeDetailSchema).describe('보낸 콕 찌름 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 보낸 콕 찌름 수'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .describe('보낸 콕 찌름 목록 응답')
  .meta({
    example: {
      nudges: [
        {
          id: 2,
          senderId: 'clz7x5p8k0001qz0z8z8z8z8z',
          receiverId: 'clz7x5p8k0005qz0z8z8z8z8z',
          todoId: 2,
          message: '같이 힘내요! 🔥',
          createdAt: '2026-01-16T15:00:00.000Z',
          readAt: '2026-01-16T16:00:00.000Z',
          sender: {
            id: 'clz7x5p8k0001qz0z8z8z8z8z',
            name: '매튜',
            profileImage: 'https://example.com/profiles/matthew.jpg',
          },
          todo: {
            id: 2,
            title: '책 읽기',
            completed: true,
          },
        },
      ],
      totalCount: 3,
      hasMore: false,
    },
  });

export type SentNudgesResponse = z.infer<typeof sentNudgesResponseSchema>;

// ============================================
// 콕 찌르기 액션 응답
// ============================================

/** 콕 찌르기 성공 응답 */
export const createNudgeResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    nudge: nudgeSchema.describe('생성된 콕 찌름'),
  })
  .describe('콕 찌르기 성공 응답')
  .meta({
    example: {
      message: '콕! 찔렀습니다 👆',
      nudge: {
        id: 3,
        senderId: 'clz7x5p8k0001qz0z8z8z8z8z',
        receiverId: 'clz7x5p8k0005qz0z8z8z8z8z',
        todoId: 3,
        message: '화이팅! 💪',
        createdAt: '2026-01-17T15:30:00.000Z',
        readAt: null,
      },
    },
  });

export type CreateNudgeResponse = z.infer<typeof createNudgeResponseSchema>;

/** 콕 찌름 확인 응답 */
export const markNudgeReadResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    readCount: z.number().int().nonnegative().describe('확인 처리된 콕 찌름 수'),
  })
  .describe('콕 찌름 확인 응답')
  .meta({
    example: {
      message: '확인했습니다.',
      readCount: 3,
    },
  });

export type MarkNudgeReadResponse = z.infer<typeof markNudgeReadResponseSchema>;

// ============================================
// 콕 찌르기 제한 정보
// ============================================

/** 일일 콕 찌르기 제한 정보 */
export const nudgeLimitInfoSchema = z
  .object({
    dailyLimit: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('하루 제한 횟수 (null = 무제한)'),
    usedToday: z.number().int().nonnegative().describe('오늘 찌른 횟수'),
    remainingToday: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('오늘 남은 횟수 (null = 무제한)'),
    isUnlimited: z.boolean().describe('무제한 여부 (프리미엄)'),
  })
  .describe('일일 콕 찌르기 제한 정보')
  .meta({
    example: {
      dailyLimit: 10,
      usedToday: 3,
      remainingToday: 7,
      isUnlimited: false,
    },
  });

export type NudgeLimitInfo = z.infer<typeof nudgeLimitInfoSchema>;

// ============================================
// 쿨다운 정보
// ============================================

/** 쿨다운 상태 정보 */
export const nudgeCooldownInfoSchema = z
  .object({
    isOnCooldown: z.boolean().describe('쿨다운 중 여부'),
    remainingSeconds: z.number().int().nonnegative().describe('남은 쿨다운 시간 (초)'),
    canNudgeAt: z.string().datetime().nullable().describe('다시 찌를 수 있는 시각 (ISO 8601)'),
  })
  .describe('쿨다운 상태 정보')
  .meta({
    example: {
      isOnCooldown: true,
      remainingSeconds: 3600,
      canNudgeAt: '2026-01-17T10:00:00.000Z',
    },
  });

export type NudgeCooldownInfo = z.infer<typeof nudgeCooldownInfoSchema>;
