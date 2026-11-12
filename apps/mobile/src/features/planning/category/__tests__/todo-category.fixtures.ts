import {
  type TodoCategory,
  type TodoCategoryDeletionPreview as TodoCategoryDeletionPreviewDto,
  todoCategoryDeletionPreviewSchema as todoCategoryDeletionPreviewDtoSchema,
  type TodoCategoryListResponse,
  type TodoCategoryWithCount,
} from '@aido/api';
import { ErrorCode, type ErrorCodeType, Errors } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';

import {
  type TodoCategoryDeletionPreview,
  todoCategoryDeletionPreviewSchema,
} from '../domains/todo-category-deletion.model';
import {
  type TodoCategoryWithCount as TodoCategoryWithCountModel,
  todoCategoryWithCountSchema,
} from '../domains/todo-category.model';

export function createTodoCategoryWithCount(
  overrides?: Partial<TodoCategoryWithCountModel>,
): TodoCategoryWithCountModel {
  return todoCategoryWithCountSchema.parse({
    id: 1,
    name: '기본',
    color: '#3B82F6',
    sortOrder: 0,
    todoCount: 0,
    ...overrides,
  });
}

export function createTodoCategoryDeletionPreview(
  overrides?: Partial<TodoCategoryDeletionPreview>,
): TodoCategoryDeletionPreview {
  return todoCategoryDeletionPreviewSchema.parse({
    todoCount: 12,
    completedTodoCount: 3,
    activeSeriesCount: 2,
    isLastCategory: false,
    ...overrides,
  });
}

export function createTodoCategoryDeletionPreviewDto(
  overrides?: Partial<TodoCategoryDeletionPreviewDto>,
): TodoCategoryDeletionPreviewDto {
  return todoCategoryDeletionPreviewDtoSchema.parse({
    categoryId: 3,
    todoCount: 12,
    completedTodoCount: 3,
    activeSeriesCount: 2,
    isLastCategory: false,
    ...overrides,
  });
}

function generateTodoCategoryDto(): TodoCategory {
  return {
    id: 1,
    userId: 'clz7x5p8k0010qz0z8z8z8z8z',
    name: '기본',
    color: '#3B82F6',
    sortOrder: 0,
    createdAt: '2026-01-29T10:00:00.000Z',
    updatedAt: '2026-01-29T10:00:00.000Z',
  };
}

export function createTodoCategoryDto(overrides?: Partial<TodoCategory>): TodoCategory {
  return {
    ...generateTodoCategoryDto(),
    ...overrides,
  };
}

function generateTodoCategoryWithCountDto(): TodoCategoryWithCount {
  return {
    ...generateTodoCategoryDto(),
    todoCount: 5,
  };
}

export function createTodoCategoryWithCountDto(
  overrides?: Partial<TodoCategoryWithCount>,
): TodoCategoryWithCount {
  return {
    ...generateTodoCategoryWithCountDto(),
    ...overrides,
  };
}

function generateTodoCategoryListDto(): TodoCategoryListResponse {
  return {
    items: [
      {
        id: 1,
        userId: 'clz7x5p8k0010qz0z8z8z8z8z',
        name: '기본',
        color: '#3B82F6',
        sortOrder: 0,
        todoCount: 5,
        createdAt: '2026-01-29T10:00:00.000Z',
        updatedAt: '2026-01-29T10:00:00.000Z',
      },
      {
        id: 2,
        userId: 'clz7x5p8k0010qz0z8z8z8z8z',
        name: '업무',
        color: '#EF4444',
        sortOrder: 1,
        todoCount: 3,
        createdAt: '2026-01-29T10:00:00.000Z',
        updatedAt: '2026-01-29T10:00:00.000Z',
      },
    ],
  };
}

export function createTodoCategoryListDto(
  overrides?: Partial<TodoCategoryListResponse>,
): TodoCategoryListResponse {
  return {
    ...generateTodoCategoryListDto(),
    ...overrides,
  };
}

/** 상태를 주지 않으면 서버 카탈로그가 그 코드에 붙이는 상태다 */
export function createTodoCategoryApiError({
  code = ErrorCode.TODO_CATEGORY_0851,
  message = '카테고리를 찾을 수 없어요',
  status = Errors[code].httpStatus,
}: Partial<{ code: ErrorCodeType; message: string; status: number }> = {}) {
  return new ApiError(code, message, status);
}
