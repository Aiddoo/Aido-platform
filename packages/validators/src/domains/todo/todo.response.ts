import { z } from 'zod';

import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';
import { todoCategorySummarySchema } from '../todo-category/todo-category.response';
import { todoVisibilitySchema } from './todo.common';

export const todoSchema = z
  .object({
    id: z.number().int().describe('할 일 고유 ID (양의 정수)'),
    userId: z.cuid().describe('사용자 ID (CUID 25자)'),
    title: z.string().describe('할 일 제목'),
    content: z.string().nullable().describe('할 일 내용 (미입력 시 null)'),
    sortOrder: z.number().int().describe('정렬 순서 (작을수록 위)'),
    completed: z.boolean().describe('완료 상태'),
    completedAt: nullableDatetimeSchema.describe(
      '완료 시각 (ISO 8601 UTC, 예: 2024-01-15T10:30:00.000Z, 미완료 시 null)',
    ),
    startDate: z.string().describe('시작 날짜 (YYYY-MM-DD, 예: 2024-01-15)'),
    endDate: z
      .string()
      .nullable()
      .describe('종료 날짜 (YYYY-MM-DD, 예: 2024-01-31, 단일 날짜는 null)'),
    scheduledTime: nullableDatetimeSchema.describe(
      '예정 시각 (ISO 8601 UTC, 예: 2024-01-15T09:00:00.000Z, 종일 일정은 null)',
    ),
    isAllDay: z.boolean().describe('종일 일정 여부'),
    visibility: todoVisibilitySchema.describe('공개 범위 (PUBLIC | FRIENDS | PRIVATE)'),
    category: todoCategorySummarySchema.describe('카테고리 정보'),
    createdAt: datetimeSchema.describe('생성 시각 (ISO 8601 UTC, 예: 2024-01-10T12:00:00.000Z)'),
    updatedAt: datetimeSchema.describe('수정 시각 (ISO 8601 UTC, 예: 2024-01-15T10:30:00.000Z)'),
  })
  .meta({
    example: {
      id: 1,
      userId: 'clz7x5p8k0010qz0z8z8z8z8z',
      title: '운동하기',
      content: '헬스장에서 1시간 운동',
      sortOrder: 0,
      completed: false,
      completedAt: null,
      startDate: '2024-01-15',
      endDate: '2024-01-15',
      scheduledTime: '2024-01-15T09:00:00.000Z',
      isAllDay: false,
      visibility: 'PUBLIC',
      category: {
        id: 1,
        name: '중요한 일',
        color: '#FFB3B3',
      },
      createdAt: '2024-01-10T12:00:00.000Z',
      updatedAt: '2024-01-10T12:00:00.000Z',
    },
  });

export type Todo = z.infer<typeof todoSchema>;

export const numberCursorPaginationInfoSchema = z.object({
  nextCursor: z.number().int().nullable(),
  hasNext: z.boolean(),
  size: z.number(),
});

/** @deprecated numberCursorPaginationInfoSchema 사용 */
export const cursorPaginationInfoSchema = numberCursorPaginationInfoSchema;

export const todoListResponseSchema = z
  .object({
    items: z.array(todoSchema),
    pagination: numberCursorPaginationInfoSchema,
  })
  .meta({
    example: {
      items: [
        {
          id: 1,
          userId: 'clz7x5p8k0010qz0z8z8z8z8z',
          title: '운동하기',
          content: '헬스장에서 1시간 운동',
          sortOrder: 0,
          completed: false,
          completedAt: null,
          startDate: '2024-01-15',
          endDate: '2024-01-15',
          scheduledTime: '2024-01-15T09:00:00.000Z',
          isAllDay: false,
          visibility: 'PUBLIC',
          category: {
            id: 1,
            name: '중요한 일',
            color: '#FFB3B3',
          },
          createdAt: '2024-01-10T12:00:00.000Z',
          updatedAt: '2024-01-10T12:00:00.000Z',
        },
      ],
      pagination: {
        nextCursor: 2,
        hasNext: true,
        size: 20,
      },
    },
  });

export type TodoListResponse = z.infer<typeof todoListResponseSchema>;

export const createTodoResponseSchema = z
  .object({
    message: z.string(),
    todo: todoSchema,
  })
  .meta({
    example: {
      message: '할 일이 생성되었습니다.',
      todo: {
        id: 1,
        userId: 'clz7x5p8k0010qz0z8z8z8z8z',
        title: '운동하기',
        content: '헬스장에서 1시간 운동',
        sortOrder: 0,
        completed: false,
        completedAt: null,
        startDate: '2024-01-15',
        endDate: '2024-01-15',
        scheduledTime: '2024-01-15T09:00:00.000Z',
        isAllDay: false,
        visibility: 'PUBLIC',
        category: {
          id: 1,
          name: '중요한 일',
          color: '#FFB3B3',
        },
        createdAt: '2024-01-10T12:00:00.000Z',
        updatedAt: '2024-01-10T12:00:00.000Z',
      },
    },
  });

export type CreateTodoResponse = z.infer<typeof createTodoResponseSchema>;

export const updateTodoResponseSchema = z
  .object({
    message: z.string(),
    todo: todoSchema,
  })
  .meta({
    example: {
      message: '할 일이 수정되었습니다.',
      todo: {
        id: 1,
        userId: 'clz7x5p8k0010qz0z8z8z8z8z',
        title: '운동하기 (수정됨)',
        content: '헬스장에서 2시간 운동',
        sortOrder: 0,
        completed: true,
        completedAt: '2024-01-15T10:30:00.000Z',
        startDate: '2024-01-15',
        endDate: '2024-01-15',
        scheduledTime: '2024-01-15T09:00:00.000Z',
        isAllDay: false,
        visibility: 'PUBLIC',
        category: {
          id: 1,
          name: '중요한 일',
          color: '#FFB3B3',
        },
        createdAt: '2024-01-10T12:00:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      },
    },
  });

export type UpdateTodoResponse = z.infer<typeof updateTodoResponseSchema>;

export const deleteTodoResponseSchema = z
  .object({
    message: z.string(),
  })
  .meta({
    example: {
      message: '할 일이 삭제되었습니다.',
    },
  });

export type DeleteTodoResponse = z.infer<typeof deleteTodoResponseSchema>;

export const reorderTodoResponseSchema = z
  .object({
    message: z.string(),
    todo: todoSchema,
  })
  .meta({
    example: {
      message: '할 일 순서가 변경되었습니다.',
      todo: {
        id: 3,
        userId: 'clz7x5p8k0010qz0z8z8z8z8z',
        title: '회의 준비',
        content: null,
        sortOrder: 1,
        completed: false,
        completedAt: null,
        startDate: '2024-01-15',
        endDate: null,
        scheduledTime: null,
        isAllDay: true,
        visibility: 'PUBLIC',
        category: {
          id: 1,
          name: '중요한 일',
          color: '#FFB3B3',
        },
        createdAt: '2024-01-10T12:00:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      },
    },
  });

export type ReorderTodoResponse = z.infer<typeof reorderTodoResponseSchema>;
