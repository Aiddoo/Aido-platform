import { z } from 'zod';
import { datetimeSchema } from '../../common/datetime';
import { numberCursorPaginationInfoSchema } from '../../common/pagination';
import { todoSchema } from '../todo/todo.response';

export const memoSchema = z
  .object({
    id: z.number().int().positive().describe('메모 ID (양의 정수)'),
    userId: z.cuid().describe('사용자 ID (CUID 25자)'),
    content: z.string().describe('메모 내용'),
    isPinned: z.boolean().describe('고정 여부'),
    sortOrder: z.number().int().describe('정렬 순서'),
    createdAt: datetimeSchema.describe('생성 시각 (ISO 8601 UTC)'),
    updatedAt: datetimeSchema.describe('수정 시각 (ISO 8601 UTC)'),
  })
  .meta({
    example: {
      id: 1,
      userId: 'clz7x5p8k0001qz0z8z8z8z8z',
      content: '장보기: 우유, 계란, 빵',
      isPinned: false,
      sortOrder: 0,
      createdAt: '2026-01-17T10:00:00.000Z',
      updatedAt: '2026-01-17T10:00:00.000Z',
    },
  });

export type Memo = z.infer<typeof memoSchema>;

export const memoDetailResponseSchema = z
  .object({
    memo: memoSchema.describe('메모 정보'),
  })
  .meta({
    example: {
      memo: {
        id: 1,
        userId: 'clz7x5p8k0001qz0z8z8z8z8z',
        content: '장보기: 우유, 계란, 빵',
        isPinned: false,
        sortOrder: 0,
        createdAt: '2026-01-17T10:00:00.000Z',
        updatedAt: '2026-01-17T10:00:00.000Z',
      },
    },
  });

export type MemoDetailResponse = z.infer<typeof memoDetailResponseSchema>;

export const memoListResponseSchema = z
  .object({
    items: z.array(memoSchema).describe('메모 목록'),
    pagination: numberCursorPaginationInfoSchema.describe('페이지네이션 정보'),
  })
  .meta({
    example: {
      items: [
        {
          id: 1,
          userId: 'clz7x5p8k0001qz0z8z8z8z8z',
          content: '장보기: 우유, 계란, 빵',
          isPinned: true,
          sortOrder: 0,
          createdAt: '2026-01-17T10:00:00.000Z',
          updatedAt: '2026-01-17T10:00:00.000Z',
        },
      ],
      pagination: {
        nextCursor: null,
        hasNext: false,
        size: 20,
      },
    },
  });

export type MemoListResponse = z.infer<typeof memoListResponseSchema>;

export const memoMutationResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    memo: memoSchema.describe('메모 정보'),
  })
  .meta({
    example: {
      message: '메모가 생성되었습니다.',
      memo: {
        id: 1,
        userId: 'clz7x5p8k0001qz0z8z8z8z8z',
        content: '장보기: 우유, 계란, 빵',
        isPinned: false,
        sortOrder: 0,
        createdAt: '2026-01-17T10:00:00.000Z',
        updatedAt: '2026-01-17T10:00:00.000Z',
      },
    },
  });

export type MemoMutationResponse = z.infer<typeof memoMutationResponseSchema>;

export const memoDeleteResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .meta({
    example: {
      message: '메모가 삭제되었습니다.',
    },
  });

export type MemoDeleteResponse = z.infer<typeof memoDeleteResponseSchema>;

export const convertMemoToTodoResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    todo: todoSchema.describe('변환된 할 일 정보'),
  })
  .meta({
    example: {
      message: '메모가 할 일로 변환되었습니다.',
      todo: {
        id: 1,
        userId: 'clz7x5p8k0001qz0z8z8z8z8z',
        title: '장보기: 우유, 계란, 빵',
        content: null,
        sortOrder: 0,
        completed: false,
        completedAt: null,
        startDate: '2026-01-17',
        endDate: null,
        scheduledTime: null,
        isAllDay: true,
        visibility: 'PUBLIC',
        recurrenceGroupId: null,
        category: { id: 1, name: '기본', color: '#4A90D9', sortOrder: 0 },
        items: [],
        itemStats: { total: 0, completed: 0 },
        createdAt: '2026-01-17T10:00:00.000Z',
        updatedAt: '2026-01-17T10:00:00.000Z',
      },
    },
  });

export type ConvertMemoToTodoResponse = z.infer<typeof convertMemoToTodoResponseSchema>;

export const convertMemoToTodosResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    todos: z.array(todoSchema).describe('변환된 할 일 목록'),
  })
  .meta({
    example: {
      message: '메모가 3개의 할 일로 변환되었습니다.',
      todos: [],
    },
  });

export type ConvertMemoToTodosResponse = z.infer<typeof convertMemoToTodosResponseSchema>;

export const memoResourceLimitResponseSchema = z
  .object({
    currentCount: z.number().int().nonnegative().describe('현재 메모 개수'),
    maxPerUser: z.number().int().positive().describe('사용자당 최대 메모 수'),
  })
  .meta({
    example: {
      currentCount: 5,
      maxPerUser: 20,
    },
  });

export type MemoResourceLimitResponse = z.infer<typeof memoResourceLimitResponseSchema>;
