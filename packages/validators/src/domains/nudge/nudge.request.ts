import { z } from 'zod';

export const createNudgeSchema = z.object({
  receiverId: z
    .cuid('유효하지 않은 사용자 ID입니다')
    .describe('받을 사용자 ID (CUID 25자, 예: clz7x5p8k0001qz0z8z8z8z8z)'),
  todoId: z
    .number()
    .int()
    .positive('유효하지 않은 Todo ID입니다')
    .describe('대상 할 일 ID (양의 정수, 예: 1)'),
  message: z
    .string()
    .max(200, '메시지는 200자 이내여야 합니다')
    .optional()
    .describe('응원 메시지 (선택, 최대 200자)'),
});

export type CreateNudgeInput = z.infer<typeof createNudgeSchema>;

export const markNudgeReadSchema = z.object({
  nudgeId: z
    .number()
    .int()
    .positive('유효하지 않은 콕 찌름 ID입니다')
    .describe('찌르기 ID (양의 정수)'),
});

export type MarkNudgeReadInput = z.infer<typeof markNudgeReadSchema>;

export const markNudgesReadSchema = z.object({
  nudgeIds: z
    .array(z.number().int().positive('유효하지 않은 콕 찌름 ID입니다'))
    .min(1, '최소 1개의 콕 찌름 ID가 필요합니다')
    .max(100, '한 번에 최대 100개까지 처리 가능합니다')
    .describe('찌르기 ID 배열 (1-100개, 양의 정수)'),
});

export type MarkNudgesReadInput = z.infer<typeof markNudgesReadSchema>;
