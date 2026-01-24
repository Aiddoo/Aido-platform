/**
 * AI 자연어 투두 파싱 응답 스키마
 * @description LLM이 파싱한 구조화된 투두 데이터
 */
import { z } from 'zod';
import { tokenUsageSchema } from './ai-usage.schema';

/** 시간 형식 검증 (HH:mm) */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// =============================================================================
// 파싱된 투두 데이터
// =============================================================================

export const parsedTodoDataSchema = z
  .object({
    title: z
      .string()
      .min(1, '제목을 추출하지 못했습니다')
      .max(200, '제목은 200자 이하여야 합니다')
      .describe('추출된 할 일 제목'),
    startDate: z.iso.date('유효한 날짜 형식이 아닙니다').describe('시작 날짜 (YYYY-MM-DD)'),
    endDate: z.iso
      .date('유효한 날짜 형식이 아닙니다')
      .nullable()
      .describe('종료 날짜 (YYYY-MM-DD), 단일 일정이면 null'),
    scheduledTime: z
      .string()
      .regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)')
      .nullable()
      .describe('예정 시간 (HH:mm), 종일 일정이면 null'),
    isAllDay: z.boolean().describe('종일 여부 (특정 시간 미지정 시 true)'),
  })
  .describe('파싱된 투두 데이터');

export type ParsedTodoData = z.infer<typeof parsedTodoDataSchema>;

// =============================================================================
// 파싱 메타데이터
// =============================================================================

export const parseTodoMetaSchema = z
  .object({
    model: z.string().describe('사용된 AI 모델명'),
    processingTimeMs: z.number().int().nonnegative().describe('처리 소요 시간 (밀리초)'),
    tokenUsage: tokenUsageSchema.describe('토큰 사용량'),
  })
  .describe('파싱 메타데이터');

export type ParseTodoMeta = z.infer<typeof parseTodoMetaSchema>;

// =============================================================================
// 전체 응답
// =============================================================================

export const parseTodoResponseSchema = z
  .object({
    success: z.literal(true).describe('성공 여부'),
    data: parsedTodoDataSchema.describe('파싱된 투두 데이터'),
    meta: parseTodoMetaSchema.describe('파싱 메타데이터'),
  })
  .describe('AI 자연어 투두 파싱 성공 응답');

export type ParseTodoResponse = z.infer<typeof parseTodoResponseSchema>;

// =============================================================================
// LLM 원시 응답 (내부용)
// =============================================================================

/**
 * LLM에서 반환되는 JSON 응답 형식
 * @internal 서비스 내부에서만 사용
 */
export const llmParsedResultSchema = z
  .object({
    title: z.string(),
    startDate: z.string(),
    endDate: z.string().nullable(),
    scheduledTime: z.string().nullable(),
    isAllDay: z.boolean(),
    reasoning: z.string(),
  })
  .describe('LLM 원시 응답 형식');

export type LlmParsedResult = z.infer<typeof llmParsedResultSchema>;
