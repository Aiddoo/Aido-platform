/**
 * AI 사용량 관련 스키마
 * @description 사용자의 일일 AI 사용량 추적
 */
import { z } from 'zod';

// =============================================================================
// AI 사용량 데이터
// =============================================================================

export const aiUsageDataSchema = z
  .object({
    used: z.number().int().nonnegative().describe('오늘 사용한 횟수'),
    limit: z.number().int().positive().describe('일일 최대 사용 횟수'),
    resetsAt: z.string().datetime().describe('다음 리셋 시간 (ISO 8601)'),
  })
  .describe('AI 사용량 정보');

export type AiUsageData = z.infer<typeof aiUsageDataSchema>;

// =============================================================================
// 토큰 사용량
// =============================================================================

export const tokenUsageSchema = z
  .object({
    input: z.number().int().nonnegative().describe('입력 토큰 수'),
    output: z.number().int().nonnegative().describe('출력 토큰 수'),
  })
  .describe('토큰 사용량');

export type TokenUsage = z.infer<typeof tokenUsageSchema>;

// =============================================================================
// AI 사용량 응답
// =============================================================================

export const aiUsageResponseSchema = z
  .object({
    success: z.literal(true).describe('성공 여부'),
    data: aiUsageDataSchema.describe('AI 사용량 정보'),
  })
  .describe('AI 사용량 조회 응답');

export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>;
