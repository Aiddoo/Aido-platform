import { z } from 'zod';

import { dateSchema, nullableDateSchema } from '../../common/datetime';
import { dayOfWeekSchema } from '../todo/todo.common';
import { tokenUsageSchema } from './ai-usage.response';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ============================================================================
// 메모 파싱 결과 스키마 (API 응답용)
// ============================================================================

const parsedMemoTodoItemSchema = z.object({
  title: z
    .string()
    .min(1, '제목을 추출하지 못했습니다')
    .max(200, '제목은 200자 이하여야 합니다')
    .describe('서브투두 제목'),
});

export const parsedMemoTodoSchema = z.object({
  title: z
    .string()
    .min(1, '제목을 추출하지 못했습니다')
    .max(200, '제목은 200자 이하여야 합니다')
    .describe('AI가 추출한 할 일 제목'),
  startDate: dateSchema.describe('시작 날짜 (YYYY-MM-DD)'),
  endDate: nullableDateSchema.describe('종료 날짜 (YYYY-MM-DD, 단일 날짜는 null)'),
  scheduledTime: z
    .string()
    .regex(timeRegex, '시간 형식이 올바르지 않습니다 (HH:mm)')
    .nullable()
    .describe('예정 시간 (HH:mm, 종일 일정은 null)'),
  isAllDay: z.boolean().describe('종일 일정 여부'),
  isRecurring: z.boolean().default(false).describe('반복 일정 여부'),
  recurrence: z
    .object({
      daysOfWeek: z.array(dayOfWeekSchema).min(1).max(7),
      endDate: dateSchema,
    })
    .nullable()
    .default(null)
    .describe('반복 설정 (비반복 일정은 null)'),
  categoryId: z.number().int().positive().describe('카테고리 ID'),
  items: z.array(parsedMemoTodoItemSchema).max(5).default([]).describe('서브투두 목록 (0-5개)'),
});

export type ParsedMemoTodo = z.infer<typeof parsedMemoTodoSchema>;

export const parsedMemoDataSchema = z.object({
  todos: z.array(parsedMemoTodoSchema).min(1).max(5).describe('파싱된 할 일 목록 (1-5개)'),
});

export type ParsedMemoData = z.infer<typeof parsedMemoDataSchema>;

export const parseMemoMetaSchema = z.object({
  model: z.string().describe('사용된 AI 모델명'),
  processingTimeMs: z.number().int().nonnegative().describe('AI 처리 시간 (밀리초)'),
  tokenUsage: tokenUsageSchema.describe('AI 토큰 사용량 정보'),
});

export type ParseMemoMeta = z.infer<typeof parseMemoMetaSchema>;

export const parseMemoResponseSchema = z.object({
  success: z.literal(true).describe('파싱 성공 여부 (항상 true)'),
  data: parsedMemoDataSchema.describe('파싱된 할 일 데이터'),
  meta: parseMemoMetaSchema.describe('AI 처리 메타데이터'),
});

export type ParseMemoResponse = z.infer<typeof parseMemoResponseSchema>;

// ============================================================================
// LLM 내부용 스키마 (categoryId 제외 — 서비스에서 주입)
// ============================================================================

export const llmParsedMemoResultSchema = z.object({
  todos: z.array(
    z.object({
      title: z.string(),
      startDate: z.string(),
      endDate: z.string().nullable(),
      scheduledTime: z.string().nullable(),
      isAllDay: z.boolean(),
      isRecurring: z.boolean().default(false),
      recurrence: z
        .object({
          daysOfWeek: z.array(dayOfWeekSchema),
          endDate: z.string(),
        })
        .nullable()
        .default(null),
      items: z.array(z.object({ title: z.string() })).default([]),
    }),
  ),
});

export type LlmParsedMemoResult = z.infer<typeof llmParsedMemoResultSchema>;
