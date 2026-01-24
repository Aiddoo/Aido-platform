/**
 * AI 자연어 투두 파싱 요청 스키마
 * @description 자연어 텍스트를 받아 구조화된 투두 데이터로 변환
 */
import { z } from 'zod';

// =============================================================================
// 자연어 투두 파싱 요청
// =============================================================================

export const parseTodoRequestSchema = z
  .object({
    text: z
      .string()
      .min(1, '텍스트를 입력해주세요')
      .max(500, '텍스트는 500자 이하로 입력해주세요')
      .describe('파싱할 자연어 텍스트 (예: "내일 오후 3시에 팀 미팅")'),
  })
  .describe('AI 자연어 투두 파싱 요청');

export type ParseTodoRequest = z.infer<typeof parseTodoRequestSchema>;
