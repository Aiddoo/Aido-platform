/**
 * Todo 관련 응답 스키마
 * @description 할 일 응답에 사용되는 Zod 스키마
 */
import { z } from 'zod';

import { todoCategorySummarySchema } from '../todo-category/todo-category.response';
import { todoVisibilitySchema } from './todo.common';

// =============================================================================
// Todo 기본 스키마
// =============================================================================

export const todoSchema = z
  .object({
    id: z.number().int().describe('할 일 고유 ID'),
    userId: z.cuid().describe('작성자 ID'),
    title: z.string().describe('할 일 제목'),
    content: z.string().nullable().describe('할 일 상세 내용'),
    sortOrder: z.number().int().describe('정렬 순서'),
    completed: z.boolean().describe('완료 여부'),
    completedAt: z.string().datetime().nullable().describe('완료 시각'),
    startDate: z.string().describe('시작 날짜'),
    endDate: z.string().nullable().describe('종료 날짜'),
    scheduledTime: z.string().datetime().nullable().describe('예정 시간'),
    isAllDay: z.boolean().describe('종일 여부'),
    visibility: todoVisibilitySchema.describe('공개 범위'),
    category: todoCategorySummarySchema.describe('카테고리 정보'),
    createdAt: z.string().datetime().describe('생성 시각'),
    updatedAt: z.string().datetime().describe('수정 시각'),
  })
  .describe('할 일 정보')
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

// =============================================================================
// 페이지네이션 정보 (숫자 커서 - Todo용)
// =============================================================================

export const numberCursorPaginationInfoSchema = z
  .object({
    nextCursor: z.number().int().nullable().describe('다음 페이지 커서 (Todo ID)'),
    hasNext: z.boolean().describe('다음 페이지 존재 여부'),
    size: z.number().describe('페이지 크기'),
  })
  .describe('숫자 커서 기반 페이지네이션 정보');

/**
 * @deprecated numberCursorPaginationInfoSchema 사용
 */
export const cursorPaginationInfoSchema = numberCursorPaginationInfoSchema;

// =============================================================================
// Todo 목록 응답
// =============================================================================

export const todoListResponseSchema = z
  .object({
    items: z.array(todoSchema).describe('할 일 목록'),
    pagination: numberCursorPaginationInfoSchema.describe('페이지네이션 정보'),
  })
  .describe('할 일 목록 응답')
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

// =============================================================================
// Todo 생성 응답
// =============================================================================

export const createTodoResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    todo: todoSchema.describe('생성된 할 일'),
  })
  .describe('할 일 생성 응답')
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

// =============================================================================
// Todo 수정 응답
// =============================================================================

export const updateTodoResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    todo: todoSchema.describe('수정된 할 일'),
  })
  .describe('할 일 수정 응답')
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

// =============================================================================
// Todo 삭제 응답
// =============================================================================

export const deleteTodoResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('할 일 삭제 응답')
  .meta({
    example: {
      message: '할 일이 삭제되었습니다.',
    },
  });

export type DeleteTodoResponse = z.infer<typeof deleteTodoResponseSchema>;

// =============================================================================
// Todo 순서 변경 응답
// =============================================================================

export const reorderTodoResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    todo: todoSchema.describe('순서가 변경된 할 일'),
  })
  .describe('할 일 순서 변경 응답')
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
