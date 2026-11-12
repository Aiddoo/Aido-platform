import {
  type TodoCategory,
  type TodoCategoryDeletionPreview as TodoCategoryDeletionPreviewDto,
  todoCategoryDeletionPreviewSchema as todoCategoryDeletionPreviewDtoSchema,
  type TodoCategoryListResponse,
  type TodoCategoryWithCount,
} from '@aido/api';
import type { ErrorCodeType } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';

import {
  type TodoCategoryDeletionPreview,
  todoCategoryDeletionPreviewSchema,
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

export function createTodoCategoryApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return new ApiError(
    overrides?.code ?? 'TODO_CATEGORY_0851',
    overrides?.message ?? '카테고리를 찾을 수 없어요',
    overrides?.status ?? 400,
  );
}

export const INVALID_DTO = { invalid: 'data' };
