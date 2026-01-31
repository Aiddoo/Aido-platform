import { z } from 'zod';
import { tokenUsageSchema } from './ai-usage.response';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const parsedTodoDataSchema = z.object({
  title: z
    .string()
    .min(1, '제목을 추출하지 못했습니다')
    .max(200, '제목은 200자 이하여야 합니다')
    .describe('AI가 추출한 할 일 제목 (1-200자, 예: "운동하기")'),
  startDate: z.iso
    .date('유효한 날짜 형식이 아닙니다')
    .describe('시작 날짜 (YYYY-MM-DD, 예: 2026-01-17)'),
  endDate: z.iso
    .date('유효한 날짜 형식이 아닙니다')
    .nullable()
    .describe('종료 날짜 (YYYY-MM-DD, 예: 2026-01-31, 단일 날짜는 null)'),
  scheduledTime: z
    .string()
    .regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)')
    .nullable()
    .describe('예정 시간 (HH:mm 24시간 형식, 예: 15:30, 종일 일정은 null)'),
  isAllDay: z.boolean().describe('종일 일정 여부'),
});

export type ParsedTodoData = z.infer<typeof parsedTodoDataSchema>;

export const parseTodoMetaSchema = z.object({
  model: z.string().describe('사용된 AI 모델명 (예: gpt-4o-mini)'),
  processingTimeMs: z.number().int().nonnegative().describe('AI 처리 시간 (밀리초, 0 이상)'),
  tokenUsage: tokenUsageSchema.describe('AI 토큰 사용량 정보'),
});

export type ParseTodoMeta = z.infer<typeof parseTodoMetaSchema>;

export const parseTodoResponseSchema = z.object({
  success: z.literal(true).describe('파싱 성공 여부 (항상 true)'),
  data: parsedTodoDataSchema.describe('파싱된 할 일 데이터'),
  meta: parseTodoMetaSchema.describe('AI 처리 메타데이터'),
});

export type ParseTodoResponse = z.infer<typeof parseTodoResponseSchema>;

/** @internal 서비스 내부에서만 사용 */
export const llmParsedResultSchema = z.object({
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  scheduledTime: z.string().nullable(),
  isAllDay: z.boolean(),
  reasoning: z.string(),
});

export type LlmParsedResult = z.infer<typeof llmParsedResultSchema>;
