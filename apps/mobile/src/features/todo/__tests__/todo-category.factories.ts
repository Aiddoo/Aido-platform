import type {
  TodoCategory,
  TodoCategoryListResponse,
  TodoCategoryWithCount,
} from '@aido/validators';
import { ApiError } from '@src/shared/errors/api-error';

const generateTodoCategoryDto = (): TodoCategory => ({
  id: 1,
  userId: 'clz7x5p8k0010qz0z8z8z8z8z',
  name: '기본',
  color: '#3B82F6',
  sortOrder: 0,
  createdAt: '2026-01-29T10:00:00.000Z',
  updatedAt: '2026-01-29T10:00:00.000Z',
});

export const createTodoCategoryDto = (overrides?: Partial<TodoCategory>): TodoCategory => ({
  ...generateTodoCategoryDto(),
  ...overrides,
});

const generateTodoCategoryWithCountDto = (): TodoCategoryWithCount => ({
  ...generateTodoCategoryDto(),
  todoCount: 5,
});

export const createTodoCategoryWithCountDto = (
  overrides?: Partial<TodoCategoryWithCount>,
): TodoCategoryWithCount => ({
  ...generateTodoCategoryWithCountDto(),
  ...overrides,
});

const generateTodoCategoryListDto = (): TodoCategoryListResponse => ({
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
});

export const createTodoCategoryListDto = (
  overrides?: Partial<TodoCategoryListResponse>,
): TodoCategoryListResponse => ({
  ...generateTodoCategoryListDto(),
  ...overrides,
});

export const createTodoCategoryApiError = (
  overrides?: Partial<{ code: string; message: string; status: number }>,
) =>
  new ApiError(
    overrides?.code ?? 'TODO_CATEGORY_0851',
    overrides?.message ?? '카테고리를 찾을 수 없어요',
    overrides?.status ?? 400,
  );

export const INVALID_DTO = { invalid: 'data' };
