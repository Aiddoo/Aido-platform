import { z } from "zod";

import { dateSchema, nullableDateSchema, timeOfDaySchema } from "../../../common/datetime.js";
import { TODO_LIMITS } from "../../../vocabulary/todo.constants.js";
import { featureQuotaSchema } from "../../entitlement/v1/entitlement.response.js";
import { dayOfWeekSchema, todoRepeatSchema } from "../../todo/v1/todo.common.js";
import { tokenUsageSchema } from "./ai-usage.response.js";

export const todoRecurrenceSchema = z.object({
  daysOfWeek: z.array(dayOfWeekSchema).min(1).max(7),
  endDate: dateSchema,
});

export const parsedTodoDataSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 추출하지 못했습니다")
    .max(TODO_LIMITS.TITLE_MAX_LENGTH, "제목은 200자 이하여야 합니다")
    .meta({ description: 'AI가 추출한 할 일 제목 (1-200자, 예: "운동하기")' }),
  startDate: dateSchema.meta({ description: "시작 날짜 (YYYY-MM-DD, 예: 2026-01-17)" }),
  endDate: nullableDateSchema.meta({
    description: "종료 날짜 (YYYY-MM-DD, 예: 2026-01-31, 단일 날짜는 null)",
  }),
  scheduledTime: timeOfDaySchema
    .nullable()
    .meta({ description: "예정 시간 (HH:mm 24시간 형식, 예: 15:30, 종일 일정은 null)" }),
  isAllDay: z.boolean().meta({ description: "종일 일정 여부" }),
  isRecurring: z.boolean().default(false).meta({ description: "반복 일정 여부" }),
  recurrence: todoRecurrenceSchema
    .nullable()
    .default(null)
    .meta({ description: "반복 설정 (비반복 일정은 null, 출시 앱용 요일+종료일)" }),
  repeat: todoRepeatSchema
    .nullable()
    .optional()
    .meta({ description: "반복 규칙 (반복이 아니면 null). 1.15.0 이전 서버 응답에는 없다" }),
  categoryId: z
    .int()
    .positive()
    .optional()
    .meta({ description: "카테고리 ID (프론트에서 전달한 값을 그대로 반환)" }),
});

export type ParsedTodoData = z.infer<typeof parsedTodoDataSchema>;

export const parseTodoMetaSchema = z.object({
  model: z.string().meta({ description: "사용된 AI 모델명 (예: google:gemini-3.1-flash-lite)" }),
  processingTimeMs: z.int().nonnegative().meta({ description: "AI 처리 시간 (밀리초, 0 이상)" }),
  tokenUsage: tokenUsageSchema.meta({ description: "AI 토큰 사용량 정보" }),
  promptVersion: z.string().optional().meta({
    description: '응답을 만든 프롬프트 버전 (예: "parse-todo@3"). 구 서버 응답에는 없을 수 있다',
  }),
});

export const parseTodoResponseSchema = z.object({
  success: z.literal(true).meta({ description: "파싱 성공 여부 (항상 true)" }),
  data: parsedTodoDataSchema.meta({ description: "파싱된 할 일 데이터" }),
  meta: parseTodoMetaSchema.meta({ description: "AI 처리 메타데이터" }),
  featureQuota: featureQuotaSchema
    .optional()
    .meta({ description: "이 요청을 반영한 AI_PARSE 한도·사용량. 1.15.0 이전 서버 응답에는 없다" }),
});
