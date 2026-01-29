/**
 * Todo 카테고리 관련 응답 스키마
 * @description 카테고리 응답에 사용되는 Zod 스키마
 */
import { z } from 'zod';

// =============================================================================
// 카테고리 기본 스키마
// =============================================================================

export const todoCategorySchema = z
  .object({
    id: z.number().int().describe('카테고리 고유 ID'),
    userId: z.cuid().describe('사용자 ID'),
    name: z.string().describe('카테고리명'),
    color: z.string().describe('색상 코드 (HEX)'),
    sortOrder: z.number().int().describe('정렬 순서'),
    createdAt: z.string().datetime().describe('생성 시각'),
    updatedAt: z.string().datetime().describe('수정 시각'),
  })
  .describe('카테고리 정보')
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

// =============================================================================
// 카테고리 요약 스키마 (Todo 응답용)
// =============================================================================

export const todoCategorySummarySchema = z
  .object({
    id: z.number().int().describe('카테고리 ID'),
    name: z.string().describe('카테고리명'),
    color: z.string().describe('색상 코드'),
  })
  .describe('카테고리 요약 정보');

export type TodoCategorySummary = z.infer<typeof todoCategorySummarySchema>;

// =============================================================================
// 카테고리 목록 아이템 (Todo 개수 포함)
// =============================================================================

export const todoCategoryWithCountSchema = todoCategorySchema
  .extend({
    todoCount: z.number().int().describe('해당 카테고리의 할 일 개수'),
  })
  .describe('카테고리 정보 (할 일 개수 포함)');

export type TodoCategoryWithCount = z.infer<typeof todoCategoryWithCountSchema>;

// =============================================================================
// 카테고리 목록 응답
// =============================================================================

export const todoCategoryListResponseSchema = z
  .object({
    items: z.array(todoCategoryWithCountSchema).describe('카테고리 목록'),
  })
  .describe('카테고리 목록 응답')
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

// =============================================================================
// 카테고리 생성 응답
// =============================================================================

export const createTodoCategoryResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    category: todoCategorySchema.describe('생성된 카테고리'),
  })
  .describe('카테고리 생성 응답')
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

// =============================================================================
// 카테고리 수정 응답
// =============================================================================

export const updateTodoCategoryResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    category: todoCategorySchema.describe('수정된 카테고리'),
  })
  .describe('카테고리 수정 응답')
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

// =============================================================================
// 카테고리 삭제 응답
// =============================================================================

export const deleteTodoCategoryResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('카테고리 삭제 응답')
  .meta({
    example: {
      message: '카테고리가 삭제되었습니다.',
    },
  });

export type DeleteTodoCategoryResponse = z.infer<typeof deleteTodoCategoryResponseSchema>;

// =============================================================================
// 카테고리 상세 조회 응답
// =============================================================================

export const todoCategoryResponseSchema = z
  .object({
    category: todoCategoryWithCountSchema.describe('카테고리 정보'),
  })
  .describe('카테고리 상세 응답');

export type TodoCategoryResponse = z.infer<typeof todoCategoryResponseSchema>;

// =============================================================================
// 카테고리 순서 변경 응답
// =============================================================================

export const reorderTodoCategoryResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    category: todoCategorySchema.describe('순서가 변경된 카테고리'),
  })
  .describe('카테고리 순서 변경 응답')
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
