/**
 * Todo 카테고리 관련 요청 스키마
 * @description 카테고리 생성, 수정, 삭제 요청에 사용되는 Zod 스키마
 */
import { z } from 'zod';

import { hexColorRegex, reorderPositionSchema } from './todo-category.common';

// =============================================================================
// 카테고리 생성
// =============================================================================

export const createTodoCategorySchema = z
  .object({
    name: z
      .string()
      .min(1, '카테고리명을 입력해주세요')
      .max(50, '카테고리명은 50자 이하로 입력해주세요')
      .describe('카테고리명'),
    color: z
      .string()
      .regex(hexColorRegex, 'HEX 색상 코드 형식이 아닙니다 (예: #FF5733)')
      .describe('색상 코드 (HEX)'),
  })
  .describe('카테고리 생성 요청');

export type CreateTodoCategoryInput = z.infer<typeof createTodoCategorySchema>;

// =============================================================================
// 카테고리 수정
// =============================================================================

export const updateTodoCategorySchema = z
  .object({
    name: z
      .string()
      .min(1, '카테고리명을 입력해주세요')
      .max(50, '카테고리명은 50자 이하로 입력해주세요')
      .optional()
      .describe('카테고리명'),
    color: z
      .string()
      .regex(hexColorRegex, 'HEX 색상 코드 형식이 아닙니다 (예: #FF5733)')
      .optional()
      .describe('색상 코드 (HEX)'),
  })
  .describe('카테고리 수정 요청')
  .refine((data) => data.name !== undefined || data.color !== undefined, {
    message: '카테고리명 또는 색상 중 하나는 입력해야 합니다',
  });

export type UpdateTodoCategoryInput = z.infer<typeof updateTodoCategorySchema>;

// =============================================================================
// 카테고리 삭제 쿼리 파라미터
// =============================================================================

export const deleteTodoCategoryQuerySchema = z
  .object({
    moveToCategoryId: z.coerce
      .number()
      .int()
      .positive('유효하지 않은 카테고리 ID입니다')
      .optional()
      .describe('할 일을 이동할 카테고리 ID'),
  })
  .describe('카테고리 삭제 쿼리');

export type DeleteTodoCategoryQuery = z.infer<typeof deleteTodoCategoryQuerySchema>;

// =============================================================================
// 카테고리 순서 변경
// =============================================================================

export const reorderTodoCategorySchema = z
  .object({
    targetCategoryId: z.coerce
      .number()
      .int()
      .positive('유효하지 않은 카테고리 ID입니다')
      .optional()
      .describe('기준 카테고리 ID (없으면 맨 처음/끝으로 이동)'),
    position: reorderPositionSchema.describe('기준 카테고리의 앞(before) 또는 뒤(after)로 이동'),
  })
  .describe('카테고리 순서 변경 요청');

export type ReorderTodoCategoryInput = z.infer<typeof reorderTodoCategorySchema>;

// =============================================================================
// 카테고리 ID 파라미터
// =============================================================================

export const todoCategoryIdParamSchema = z
  .object({
    id: z.coerce.number().int().positive('유효하지 않은 카테고리 ID입니다').describe('카테고리 ID'),
  })
  .describe('카테고리 ID 파라미터');

export type TodoCategoryIdParam = z.infer<typeof todoCategoryIdParamSchema>;
