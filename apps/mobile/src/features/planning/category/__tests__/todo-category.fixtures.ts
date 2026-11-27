import {
  todoCategoryDeletionPreviewSchema as todoCategoryDeletionPreviewDtoSchema,
  todoCategoryListResponseSchema,
  todoCategorySchema as todoCategoryDtoSchema,
  todoCategoryWithCountSchema as todoCategoryWithCountDtoSchema,
} from '@aido/api/contracts/todo-category/v1';
import { ErrorCode, type ErrorCodeType } from '@aido/api/errors';
import { createApiError } from '@src/testing/api-error';
import { defineFixture } from '@src/testing/fixture';

import { todoCategoryWithCountSchema } from '../domains/todo-categories.model';
import { todoCategoryDeletionPreviewSchema } from '../domains/todo-category-deletion.model';

export const createTodoCategoryWithCount = defineFixture(todoCategoryWithCountSchema, {
  id: 1,
  name: '기본',
  color: '#3B82F6',
  sortOrder: 0,
  todoCount: 0,
});

export const createTodoCategoryDeletionPreview = defineFixture(todoCategoryDeletionPreviewSchema, {
  todoCount: 12,
  completedTodoCount: 3,
  activeSeriesCount: 2,
  isLastCategory: false,
});

export const createTodoCategoryDeletionPreviewDto = defineFixture(
  todoCategoryDeletionPreviewDtoSchema,
  {
    categoryId: 3,
    todoCount: 12,
    completedTodoCount: 3,
    activeSeriesCount: 2,
    isLastCategory: false,
  },
);

const TODO_CATEGORY_DTO = {
  id: 1,
  userId: 'clz7x5p8k0010qz0z8z8z8z8z',
  name: '기본',
  color: '#3B82F6',
  sortOrder: 0,
  createdAt: '2026-01-29T10:00:00.000Z',
  updatedAt: '2026-01-29T10:00:00.000Z',
};

export const createTodoCategoryDto = defineFixture(todoCategoryDtoSchema, TODO_CATEGORY_DTO);

export const createTodoCategoryWithCountDto = defineFixture(todoCategoryWithCountDtoSchema, {
  ...TODO_CATEGORY_DTO,
  todoCount: 5,
});

export const createTodoCategoryListDto = defineFixture(todoCategoryListResponseSchema, {
  items: [
    { ...TODO_CATEGORY_DTO, todoCount: 5 },
    { ...TODO_CATEGORY_DTO, id: 2, name: '업무', color: '#EF4444', sortOrder: 1, todoCount: 3 },
  ],
});

export function createTodoCategoryApiError({
  code = ErrorCode.TODO_CATEGORY_0851,
  message = '카테고리를 찾을 수 없어요',
  status,
}: Partial<{ code: ErrorCodeType; message: string; status: number }> = {}) {
  return createApiError(code, { message, status });
}
