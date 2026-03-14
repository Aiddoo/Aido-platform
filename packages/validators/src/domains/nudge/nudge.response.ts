import { z } from 'zod';
import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';

export const nudgeSchema = z
  .object({
    id: z.number().int().positive().describe('찌르기 ID (양의 정수)'),
    senderId: z.cuid().describe('보낸 사용자 ID (CUID 25자)'),
    receiverId: z.cuid().describe('받은 사용자 ID (CUID 25자)'),
    todoId: z.number().int().positive().describe('대상 할 일 ID (양의 정수)'),
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
      todoId: 1,
      message: '오늘 할 일 잊지 마세요! 💪',
      createdAt: '2026-01-17T10:00:00.000Z',
      readAt: null,
    },
  });

export type Nudge = z.infer<typeof nudgeSchema>;

export const nudgeSenderSchema = z
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

export type NudgeSender = z.infer<typeof nudgeSenderSchema>;

export const nudgeTodoSchema = z
  .object({
    id: z.number().int().positive().describe('할 일 ID (양의 정수)'),
    title: z.string().max(200).describe('할 일 제목 (최대 200자)'),
    completed: z.boolean().describe('완료 여부'),
  })
  .meta({
    example: {
      id: 1,
      title: '운동하기',
      completed: false,
    },
  });

export type NudgeTodo = z.infer<typeof nudgeTodoSchema>;

export const nudgeDetailSchema = nudgeSchema
  .extend({
    sender: nudgeSenderSchema,
    todo: nudgeTodoSchema,
  })
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
        userTag: 'JOHN2026',
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

export const receivedNudgesResponseSchema = z
  .object({
    nudges: z.array(nudgeDetailSchema).describe('받은 찌르기 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 받은 찌르기 수 (음이 아닌 정수)'),
    unreadCount: z.number().int().nonnegative().describe('읽지 않은 찌르기 수 (음이 아닌 정수)'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
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
            userTag: 'JOHN2026',
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

export const sentNudgesResponseSchema = z
  .object({
    nudges: z.array(nudgeDetailSchema).describe('보낸 찌르기 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 보낸 찌르기 수 (음이 아닌 정수)'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
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
            userTag: 'MATT2026',
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

export const createNudgeResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    nudge: nudgeSchema.describe('생성된 찌르기 정보'),
  })
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

export const markNudgeReadResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    readCount: z.number().int().nonnegative().describe('읽음 처리된 찌르기 수 (음이 아닌 정수)'),
  })
  .meta({
    example: {
      message: '확인했습니다.',
      readCount: 3,
    },
  });

export type MarkNudgeReadResponse = z.infer<typeof markNudgeReadResponseSchema>;

export const nudgeLimitInfoSchema = z
  .object({
    dailyLimit: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('일일 찌르기 제한 (음이 아닌 정수, 무제한 시 null)'),
    usedToday: z.number().int().nonnegative().describe('오늘 사용한 찌르기 수 (음이 아닌 정수)'),
    remainingToday: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('오늘 남은 찌르기 수 (음이 아닌 정수, 무제한 시 null)'),
    isUnlimited: z.boolean().describe('무제한 여부'),
  })
  .meta({
    example: {
      dailyLimit: 10,
      usedToday: 3,
      remainingToday: 7,
      isUnlimited: false,
    },
  });

export type NudgeLimitInfo = z.infer<typeof nudgeLimitInfoSchema>;

export const nudgeCooldownInfoSchema = z
  .object({
    canNudge: z.boolean().describe('찌르기 가능 여부'),
    cooldownEndsAt: nullableDatetimeSchema.describe(
      '쿨다운 종료 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z, 쿨다운 없으면 null)',
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
      canNudge: false,
      cooldownEndsAt: '2026-01-17T10:00:00.000Z',
      remainingSeconds: 3600,
    },
  });

export type NudgeCooldownInfo = z.infer<typeof nudgeCooldownInfoSchema>;

export const remindNudgeSchema = z
  .object({
    id: z.number().int().positive().describe('리마인드 찌르기 ID (양의 정수)'),
    senderId: z.cuid().describe('보낸 사용자 ID (CUID 25자)'),
    receiverId: z.cuid().describe('받은 사용자 ID (CUID 25자)'),
    message: z.string().max(200).nullable().describe('독촉 메시지 (최대 200자, 미설정 시 null)'),
    createdAt: datetimeSchema.describe('생성 시각 (ISO 8601 UTC)'),
  })
  .meta({
    example: {
      id: 1,
      senderId: 'clz7x5p8k0005qz0z8z8z8z8z',
      receiverId: 'clz7x5p8k0001qz0z8z8z8z8z',
      message: '할일 좀 만들어!',
      createdAt: '2026-01-17T10:00:00.000Z',
    },
  });

export type RemindNudge = z.infer<typeof remindNudgeSchema>;

export const createRemindNudgeResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    remindNudge: remindNudgeSchema.describe('생성된 리마인드 찌르기 정보'),
  })
  .meta({
    example: {
      message: '할일 좀 만들어! 콕 찔렀습니다 👆',
      remindNudge: {
        id: 1,
        senderId: 'clz7x5p8k0001qz0z8z8z8z8z',
        receiverId: 'clz7x5p8k0005qz0z8z8z8z8z',
        message: null,
        createdAt: '2026-01-17T15:30:00.000Z',
      },
    },
  });

export type CreateRemindNudgeResponse = z.infer<typeof createRemindNudgeResponseSchema>;
