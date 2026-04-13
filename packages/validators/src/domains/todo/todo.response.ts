import { z } from 'zod';

import { datetimeSchema, nullableDatetimeSchema } from '../../common/datetime';
import { numberCursorPaginationInfoSchema } from '../../common/pagination';
import { todoCategorySummarySchema } from '../todo-category/todo-category.response';
import { todoVisibilitySchema } from './todo.common';

export const todoItemResponseSchema = z.object({
  id: z.number().int().describe('하위 항목 고유 ID'),
  title: z.string().describe('하위 항목 제목'),
  completed: z.boolean().describe('완료 상태'),
  sortOrder: z.number().int().describe('정렬 순서 (작을수록 위)'),
  createdAt: datetimeSchema.describe('생성 시각 (ISO 8601 UTC)'),
  updatedAt: datetimeSchema.describe('수정 시각 (ISO 8601 UTC)'),
});

export type TodoItemResponse = z.infer<typeof todoItemResponseSchema>;

export const todoItemStatsSchema = z.object({
  total: z.number().int().describe('전체 하위 항목 수'),
  completed: z.number().int().describe('완료된 하위 항목 수'),
});

export type TodoItemStats = z.infer<typeof todoItemStatsSchema>;

export const todoSchema = z
  .object({
    id: z.number().int().describe('할 일 고유 ID (양의 정수)'),
    userId: z.cuid().describe('사용자 ID (CUID 25자)'),
    title: z.string().describe('할 일 제목'),
    content: z.string().nullable().optional().describe('할 일 내용 (deprecated, 하위 호환용 — 항상 null)'),
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
    recurrenceGroupId: z.string().nullable().describe('반복 생성 그룹 ID (null이면 단일 생성)'),
    category: todoCategorySummarySchema.describe('카테고리 정보'),
    items: z
      .array(todoItemResponseSchema)
      .describe('하위 항목 목록 (체크리스트, sortOrder 오름차순)'),
    itemStats: todoItemStatsSchema.describe('하위 항목 진행 통계 (카운터 뱃지/진행률 바용)'),
    createdAt: datetimeSchema.describe('생성 시각 (ISO 8601 UTC, 예: 2024-01-10T12:00:00.000Z)'),
    updatedAt: datetimeSchema.describe('수정 시각 (ISO 8601 UTC, 예: 2024-01-15T10:30:00.000Z)'),
  })
  .meta({
    example: {
      id: 1,
      userId: 'clz7x5p8k0010qz0z8z8z8z8z',
      title: '운동하기',
      sortOrder: 0,
      completed: false,
      completedAt: null,
      startDate: '2024-01-15',
      endDate: '2024-01-15',
      scheduledTime: '2024-01-15T09:00:00.000Z',
      isAllDay: false,
      visibility: 'PUBLIC',
      recurrenceGroupId: null,
      category: {
        id: 1,
        name: '중요한 일',
        color: '#FFB3B3',
        sortOrder: 0,
      },
      items: [],
      itemStats: { total: 0, completed: 0 },
      createdAt: '2024-01-10T12:00:00.000Z',
      updatedAt: '2024-01-10T12:00:00.000Z',
    },
  });

export type Todo = z.infer<typeof todoSchema>;

export { numberCursorPaginationInfoSchema };

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
            sortOrder: 0,
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
          sortOrder: 0,
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
          sortOrder: 0,
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
          sortOrder: 0,
        },
        createdAt: '2024-01-10T12:00:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      },
    },
  });

export type ReorderTodoResponse = z.infer<typeof reorderTodoResponseSchema>;

export const createRecurringTodoResponseSchema = z
  .object({
    message: z.string(),
    todos: z.array(todoSchema),
    count: z.number().int().describe('생성된 반복 할 일 수'),
  })
  .meta({
    example: {
      message: '반복 할 일이 13개 생성되었습니다.',
      todos: [],
      count: 13,
    },
  });

export type CreateRecurringTodoResponse = z.infer<typeof createRecurringTodoResponseSchema>;

export const todoResourceLimitResponseSchema = z
  .object({
    maxPerCategory: z.number().int().describe('카테고리당 최대 활성 할 일 수'),
    activeCount: z
      .number()
      .int()
      .optional()
      .describe('해당 카테고리의 현재 활성 할 일 개수 (categoryId 지정 시)'),
  })
  .meta({
    example: {
      maxPerCategory: 300,
      activeCount: 15,
    },
  });

export type TodoResourceLimitResponse = z.infer<typeof todoResourceLimitResponseSchema>;
