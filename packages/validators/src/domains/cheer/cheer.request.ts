/**
 * Cheer Request DTO 스키마
 *
 * 응원 관련 요청 검증을 위한 Zod 스키마
 */
import { z } from 'zod';
import { CHEER_LIMITS } from './cheer.constants';

// ============================================
// 응원 보내기 요청
// ============================================

/** 응원 보내기 요청 */
export const createCheerSchema = z
  .object({
    receiverId: z.string().cuid('유효하지 않은 사용자 ID입니다').describe('응원할 친구의 ID'),
    message: z
      .string()
      .max(
        CHEER_LIMITS.MAX_MESSAGE_LENGTH,
        `메시지는 ${CHEER_LIMITS.MAX_MESSAGE_LENGTH}자 이내여야 합니다`,
      )
      .optional()
      .describe('응원 메시지 (선택, 최대 200자)'),
  })
  .describe('응원 보내기 요청');

export type CreateCheerInput = z.infer<typeof createCheerSchema>;

// ============================================
// 응원 확인 처리
// ============================================

/** 응원 확인 처리 요청 */
export const markCheerReadSchema = z
  .object({
    cheerId: z.number().int().positive('유효하지 않은 응원 ID입니다').describe('확인할 응원 ID'),
  })
  .describe('응원 확인 처리 요청');

export type MarkCheerReadInput = z.infer<typeof markCheerReadSchema>;

/** 여러 응원 확인 처리 요청 */
export const markCheersReadSchema = z
  .object({
    cheerIds: z
      .array(z.number().int().positive('유효하지 않은 응원 ID입니다'))
      .min(1, '최소 1개의 응원 ID가 필요합니다')
      .max(100, '한 번에 최대 100개까지 처리 가능합니다')
      .describe('확인할 응원 ID 목록'),
  })
  .describe('여러 응원 확인 처리 요청');

export type MarkCheersReadInput = z.infer<typeof markCheersReadSchema>;
