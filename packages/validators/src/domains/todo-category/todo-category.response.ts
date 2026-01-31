import { z } from 'zod';

export const todoCategorySchema = z
  .object({
    id: z.number().int().describe('카테고리 ID (양의 정수)'),
    userId: z.cuid().describe('사용자 ID (CUID 25자)'),
    name: z.string().describe('카테고리 이름 (최대 50자)'),
    color: z.string().describe('카테고리 색상 (HEX 7자, 예: #FFB3B3)'),
    sortOrder: z.number().int().describe('정렬 순서 (작을수록 위)'),
    createdAt: z.iso.datetime().describe('생성 시각 (ISO 8601 UTC, 예: 2026-01-29T10:00:00.000Z)'),
    updatedAt: z.iso.datetime().describe('수정 시각 (ISO 8601 UTC, 예: 2026-01-29T10:00:00.000Z)'),
  })
  .meta({
    example: {
      id: 1,
      userId: 'clz7x5p8k0010qz0z8z8z8z8z',
      name: '중요한 일',
      color: '#FFB3B3',
      sortOrder: 0,
      createdAt: '2026-01-29T10:00:00.000Z',
      updatedAt: '2026-01-29T10:00:00.000Z',
    },
  });

export type TodoCategory = z.infer<typeof todoCategorySchema>;

export const todoCategorySummarySchema = z.object({
  id: z.number().int().describe('카테고리 ID (양의 정수)'),
  name: z.string().describe('카테고리 이름'),
  color: z.string().describe('카테고리 색상 (HEX 7자)'),
});

export type TodoCategorySummary = z.infer<typeof todoCategorySummarySchema>;

export const todoCategoryWithCountSchema = todoCategorySchema.extend({
  todoCount: z.number().int().describe('카테고리 내 할 일 개수 (음이 아닌 정수)'),
});

export type TodoCategoryWithCount = z.infer<typeof todoCategoryWithCountSchema>;

export const todoCategoryListResponseSchema = z
  .object({
    items: z.array(todoCategoryWithCountSchema).describe('카테고리 목록 (할 일 개수 포함)'),
  })
  .meta({
    example: {
      items: [
        {
          id: 1,
          userId: 'clz7x5p8k0010qz0z8z8z8z8z',
          name: '중요한 일',
          color: '#FFB3B3',
          sortOrder: 0,
          todoCount: 5,
          createdAt: '2026-01-29T10:00:00.000Z',
          updatedAt: '2026-01-29T10:00:00.000Z',
        },
        {
          id: 2,
          userId: 'clz7x5p8k0010qz0z8z8z8z8z',
          name: '할 일',
          color: '#FF6B43',
          sortOrder: 1,
          todoCount: 3,
          createdAt: '2026-01-29T10:00:00.000Z',
          updatedAt: '2026-01-29T10:00:00.000Z',
        },
      ],
    },
  });

export type TodoCategoryListResponse = z.infer<typeof todoCategoryListResponseSchema>;

export const createTodoCategoryResponseSchema = z
  .object({
    message: z.string(),
    category: todoCategorySchema,
  })
  .meta({
    example: {
      message: '카테고리가 생성되었습니다.',
      category: {
        id: 1,
        userId: 'clz7x5p8k0010qz0z8z8z8z8z',
        name: '중요한 일',
        color: '#FFB3B3',
        sortOrder: 0,
        createdAt: '2026-01-29T10:00:00.000Z',
        updatedAt: '2026-01-29T10:00:00.000Z',
      },
    },
  });

export type CreateTodoCategoryResponse = z.infer<typeof createTodoCategoryResponseSchema>;

export const updateTodoCategoryResponseSchema = z
  .object({
    message: z.string(),
    category: todoCategorySchema,
  })
  .meta({
    example: {
      message: '카테고리가 수정되었습니다.',
      category: {
        id: 1,
        userId: 'clz7x5p8k0010qz0z8z8z8z8z',
        name: '중요한 일 (수정됨)',
        color: '#FF0000',
        sortOrder: 0,
        createdAt: '2026-01-29T10:00:00.000Z',
        updatedAt: '2026-01-29T11:00:00.000Z',
      },
    },
  });

export type UpdateTodoCategoryResponse = z.infer<typeof updateTodoCategoryResponseSchema>;

export const deleteTodoCategoryResponseSchema = z
  .object({
    message: z.string(),
  })
  .meta({
    example: {
      message: '카테고리가 삭제되었습니다.',
    },
  });

export type DeleteTodoCategoryResponse = z.infer<typeof deleteTodoCategoryResponseSchema>;

export const todoCategoryResponseSchema = z.object({
  category: todoCategoryWithCountSchema,
});

export type TodoCategoryResponse = z.infer<typeof todoCategoryResponseSchema>;

export const reorderTodoCategoryResponseSchema = z
  .object({
    message: z.string(),
    category: todoCategorySchema,
  })
  .meta({
    example: {
      message: '카테고리 순서가 변경되었습니다.',
      category: {
        id: 3,
        userId: 'clz7x5p8k0010qz0z8z8z8z8z',
        name: '공부',
        color: '#4A90D9',
        sortOrder: 1,
        createdAt: '2026-01-29T10:00:00.000Z',
        updatedAt: '2026-01-29T11:00:00.000Z',
      },
    },
  });

export type ReorderTodoCategoryResponse = z.infer<typeof reorderTodoCategoryResponseSchema>;
