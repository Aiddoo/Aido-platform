import { z } from "zod";

import { dateSchema, nullableDateSchema, timeOfDaySchema } from "../../../common/datetime.js";
import { AI_PARSE_LIMITS } from "../../../vocabulary/ai.constants.js";
import { TODO_LIMITS } from "../../../vocabulary/todo.constants.js";
import { featureQuotaSchema } from "../../entitlement/v1/entitlement.response.js";
import { dayOfWeekSchema, todoRepeatSchema } from "../../todo/v1/todo.common.js";
import { tokenUsageSchema } from "./ai-usage.response.js";

// ============================================================================
// 메모 파싱 결과 스키마 (API 응답용)
// ============================================================================

const parsedMemoTodoItemSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 추출하지 못했습니다")
    .max(200, "제목은 200자 이하여야 합니다")
    .describe("서브투두 제목"),
});

export const parsedMemoTodoSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 추출하지 못했습니다")
    .max(TODO_LIMITS.TITLE_MAX_LENGTH, "제목은 200자 이하여야 합니다")
    .describe("AI가 추출한 할 일 제목"),
  startDate: dateSchema.describe("시작 날짜 (YYYY-MM-DD)"),
  endDate: nullableDateSchema.describe("종료 날짜 (YYYY-MM-DD, 단일 날짜는 null)"),
  scheduledTime: timeOfDaySchema.nullable().describe("예정 시간 (HH:mm, 종일 일정은 null)"),
  isAllDay: z.boolean().describe("종일 일정 여부"),
  isRecurring: z.boolean().default(false).describe("반복 일정 여부"),
  recurrence: z
    .object({
      daysOfWeek: z.array(dayOfWeekSchema).min(1).max(7),
      endDate: dateSchema,
    })
    .nullable()
    .default(null)
    .describe("반복 설정 (비반복 일정은 null, 출시 앱용 요일+종료일)"),
  repeat: todoRepeatSchema
    .nullable()
    .optional()
    .describe("반복 규칙 (반복이 아니면 null). 1.15.0 이전 서버 응답에는 없다"),
  categoryId: z.number().int().positive().describe("카테고리 ID"),
  items: z
    .array(parsedMemoTodoItemSchema)
    .max(AI_PARSE_LIMITS.MEMO_MAX_ITEMS)
    .default([])
    .describe(`서브투두 목록 (0-${AI_PARSE_LIMITS.MEMO_MAX_ITEMS}개)`),
  duplicateOfTodoId: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe("이미 있는 같은 할 일의 ID (없으면 null). 1.15.0 이전 서버 응답에는 없다"),
});

export type ParsedMemoTodo = z.infer<typeof parsedMemoTodoSchema>;

export const parsedMemoDataSchema = z.object({
  todos: z
    .array(parsedMemoTodoSchema)
    .min(1)
    .max(AI_PARSE_LIMITS.MEMO_MAX_TODOS)
    .describe(`파싱된 할 일 목록 (1-${AI_PARSE_LIMITS.MEMO_MAX_TODOS}개)`),
});

export type ParsedMemoData = z.infer<typeof parsedMemoDataSchema>;

export const parseMemoMetaSchema = z.object({
  model: z.string().describe("사용된 AI 모델명"),
  processingTimeMs: z.number().int().nonnegative().describe("AI 처리 시간 (밀리초)"),
  tokenUsage: tokenUsageSchema.describe("AI 토큰 사용량 정보"),
  promptVersion: z
    .string()
    .optional()
    .describe('응답을 만든 프롬프트 버전 (예: "parse-memo@3"). 구 서버 응답에는 없을 수 있다'),
  omittedTodoCount: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      `할 일을 ${AI_PARSE_LIMITS.MEMO_MAX_TODOS}개까지만 만들어 생략한 할 일 수입니다. 메모 원문은 그대로 남습니다. 구 서버 응답에는 없을 수 있습니다`,
    ),
});

export type ParseMemoMeta = z.infer<typeof parseMemoMetaSchema>;

export const parseMemoResponseSchema = z.object({
  success: z.literal(true).describe("파싱 성공 여부 (항상 true)"),
  data: parsedMemoDataSchema.describe("파싱된 할 일 데이터"),
  meta: parseMemoMetaSchema.describe("AI 처리 메타데이터"),
  featureQuota: featureQuotaSchema
    .optional()
    .describe("이 요청을 반영한 AI_PARSE 한도·사용량. 1.15.0 이전 서버 응답에는 없다"),
});

export type ParseMemoResponse = z.infer<typeof parseMemoResponseSchema>;
