import type {
  DailyCompletionsRangeResponse,
  Todo as TodoDto,
  TodoItemResponse,
  TodoListResponse,
} from '@aido/api';
import { ApiError } from '@src/core/errors/api-error';

import { type TodoDetails, todoDetailsSchema } from '../domains/todo.model';
import type { TodoFormValues } from '../schemas/todo-form.schema';
import { createParentTodo } from './sub-todo.fixtures';

function generateTodoDto(): TodoDto {
  return {
    id: 1,
    userId: 'clz7x5p8k0010qz0z8z8z8z8z',
    title: '테스트 할일',
    sortOrder: 0,
    startDate: '2026-03-08',
    endDate: null,
    category: { id: 1, name: '기본', color: '#3B82F6', sortOrder: 0 },
    completed: false,
    completedAt: null,
    scheduledTime: '2026-03-08T09:00:00.000Z',
    isAllDay: false,
    visibility: 'PUBLIC',
    recurrenceGroupId: null,
    repeat: null,
    items: [],
    itemStats: { total: 0, completed: 0 },
    commentCount: 0,
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
  };
}

export function createTodoDto(overrides?: Partial<TodoDto>): TodoDto {
  return {
    ...generateTodoDto(),
    ...overrides,
  };
}

function generateTodoListResponseDto(): TodoListResponse {
  return {
    items: [generateTodoDto()],
    pagination: {
      hasNext: false,
      nextCursor: null,
      size: 20,
    },
  };
}

export function createTodoListResponseDto(overrides?: Partial<TodoListResponse>): TodoListResponse {
  return {
    ...generateTodoListResponseDto(),
    ...overrides,
  };
}

function generateDailyCompletionsDto(): DailyCompletionsRangeResponse {
  return {
    completions: [
      {
        date: '2026-03-01',
        totalTodos: 5,
        completedTodos: 3,
        isComplete: false,
        completionRate: 60,
        categoryColors: ['#FF6B43'],
      },
    ],
    totalCompleteDays: 1,
    dateRange: {
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    },
  };
}

export function createDailyCompletionsDto(
  overrides?: Partial<DailyCompletionsRangeResponse>,
): DailyCompletionsRangeResponse {
  return {
    ...generateDailyCompletionsDto(),
    ...overrides,
  };
}

function generateTodoItemResponseDto(): TodoItemResponse {
  return {
    id: 1,
    title: '테스트 항목',
    completed: false,
    sortOrder: 0,
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
  };
}

export function createTodoItemResponseDto(overrides?: Partial<TodoItemResponse>): TodoItemResponse {
  return {
    ...generateTodoItemResponseDto(),
    ...overrides,
  };
}

export function createTodoApiError(
  overrides?: Partial<{ code: string; message: string; status: number }>,
) {
  return new ApiError(
    overrides?.code ?? 'TODO_0801',
    overrides?.message ?? '할일을 찾을 수 없어요',
    overrides?.status ?? 400,
  );
}

export const INVALID_DTO = { invalid: 'data' };

export function createTodoDetails(overrides?: Partial<TodoDetails>): TodoDetails {
  return todoDetailsSchema.parse({
    todo: createParentTodo(),
    owner: { id: 'clz7x5p8k0010qz0z8z8z8z8z', name: '친구', profileImage: null },
    permissions: { canEdit: false, canComment: true, canNudge: true },
    metrics: { viewCount: 0, commentCount: 0 },
    ...overrides,
  });
}

/** 작성 시트의 기본값과 같은 하루짜리 종일 할 일 폼 값 */
export function createTodoFormValues(overrides: Partial<TodoFormValues> = {}): TodoFormValues {
  return {
    title: '테스트 할일',
    categoryId: 1,
    startDate: '2026-03-08',
    endDate: null,
    scheduledTime: null,
    isAllDay: true,
    visibility: 'PUBLIC',
    repeat: null,
    ...overrides,
  };
}
