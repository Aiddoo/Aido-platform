import { z } from 'zod';

import { datetimeSchema } from '../../common/datetime';

export const aiUsageDataSchema = z.object({
  used: z.number().int().nonnegative().describe('현재까지 사용한 AI 요청 횟수 (0 이상)'),
  limit: z.number().int().positive().describe('일일 최대 AI 요청 횟수 (양의 정수)'),
  resetsAt: datetimeSchema.describe(
    '사용량 리셋 시각 (ISO 8601 UTC, 예: 2026-01-18T00:00:00.000Z)',
  ),
});

export type AiUsageData = z.infer<typeof aiUsageDataSchema>;

export const tokenUsageSchema = z.object({
  input: z.number().int().nonnegative().describe('입력 토큰 수 (0 이상)'),
  output: z.number().int().nonnegative().describe('출력 토큰 수 (0 이상)'),
});

export type TokenUsage = z.infer<typeof tokenUsageSchema>;

export const aiUsageResponseSchema = z.object({
  success: z.literal(true).describe('조회 성공 여부 (항상 true)'),
  data: aiUsageDataSchema.describe('AI 사용량 정보'),
});

export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>;
