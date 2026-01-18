/**
 * Nudge Request DTO 스키마
 *
 * 콕 찌르기 관련 요청 검증을 위한 Zod 스키마
 */
import { z } from 'zod';

// ============================================
// 콕 찌르기 요청
// ============================================

/** 콕 찌르기 요청 */
export const createNudgeSchema = z
  .object({
    receiverId: z.string().cuid('유효하지 않은 사용자 ID입니다').describe('콕 찌를 친구의 ID'),
    todoId: z.number().int().positive('유효하지 않은 Todo ID입니다').describe('찔러줄 할 일의 ID'),
    message: z
      .string()
      .max(200, '메시지는 200자 이내여야 합니다')
      .optional()
      .describe('응원 메시지 (선택, 최대 200자)'),
  })
  .describe('콕 찌르기 요청');

export type CreateNudgeInput = z.infer<typeof createNudgeSchema>;

// ============================================
// 콕 찌름 확인 처리
// ============================================

/** 콕 찌름 확인 처리 요청 */
export const markNudgeReadSchema = z
  .object({
    nudgeId: z
      .number()
      .int()
      .positive('유효하지 않은 콕 찌름 ID입니다')
      .describe('확인할 콕 찌름 ID'),
  })
  .describe('콕 찌름 확인 처리 요청');

export type MarkNudgeReadInput = z.infer<typeof markNudgeReadSchema>;

/** 여러 콕 찌름 확인 처리 요청 */
export const markNudgesReadSchema = z
  .object({
    nudgeIds: z
      .array(z.number().int().positive('유효하지 않은 콕 찌름 ID입니다'))
      .min(1, '최소 1개의 콕 찌름 ID가 필요합니다')
      .max(100, '한 번에 최대 100개까지 처리 가능합니다')
      .describe('확인할 콕 찌름 ID 목록'),
  })
  .describe('여러 콕 찌름 확인 처리 요청');

export type MarkNudgesReadInput = z.infer<typeof markNudgesReadSchema>;
