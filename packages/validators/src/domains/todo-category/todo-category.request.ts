import { z } from 'zod';

import { hexColorRegex, reorderPositionSchema } from './todo-category.common';

export const createTodoCategorySchema = z.object({
  name: z
    .string()
    .min(1, '카테고리명을 입력해주세요')
    .max(50, '카테고리명은 50자 이하로 입력해주세요')
    .describe('카테고리 이름 (1-50자, 예: 중요한 일)'),
  color: z
    .string()
    .regex(hexColorRegex, 'HEX 색상 코드 형식이 아닙니다 (예: #FF5733)')
    .describe('카테고리 색상 (HEX 7자, 예: #FF5733)'),
});

export type CreateTodoCategoryInput = z.infer<typeof createTodoCategorySchema>;

export const updateTodoCategorySchema = z
  .object({
    name: z
      .string()
      .min(1, '카테고리명을 입력해주세요')
      .max(50, '카테고리명은 50자 이하로 입력해주세요')
      .optional()
      .describe('카테고리 이름 (선택, 1-50자, 예: 중요한 일)'),
    color: z
      .string()
      .regex(hexColorRegex, 'HEX 색상 코드 형식이 아닙니다 (예: #FF5733)')
      .optional()
      .describe('카테고리 색상 (선택, HEX 7자, 예: #FF5733)'),
  })
  .refine((data) => data.name !== undefined || data.color !== undefined, {
    message: '카테고리명 또는 색상 중 하나는 입력해야 합니다',
  });

export type UpdateTodoCategoryInput = z.infer<typeof updateTodoCategorySchema>;

export const deleteTodoCategoryQuerySchema = z.object({
  moveToCategoryId: z.coerce
    .number()
    .int()
    .positive('유효하지 않은 카테고리 ID입니다')
    .optional()
    .describe('할 일을 이동할 카테고리 ID (선택, 양의 정수)'),
});

export type DeleteTodoCategoryQuery = z.infer<typeof deleteTodoCategoryQuerySchema>;

export const reorderTodoCategorySchema = z.object({
  targetCategoryId: z.coerce
    .number()
    .int()
    .positive('유효하지 않은 카테고리 ID입니다')
    .optional()
    .describe('기준 카테고리 ID (선택, 양의 정수)'),
  position: reorderPositionSchema.describe('이동 위치 (BEFORE | AFTER | START | END)'),
});

export type ReorderTodoCategoryInput = z.infer<typeof reorderTodoCategorySchema>;

export const todoCategoryIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive('유효하지 않은 카테고리 ID입니다')
    .describe('카테고리 ID (양의 정수, 예: 1)'),
});

export type TodoCategoryIdParam = z.infer<typeof todoCategoryIdParamSchema>;
