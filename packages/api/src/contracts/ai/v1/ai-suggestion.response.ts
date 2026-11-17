import { z } from "zod";

import { dateSchema, datetimeSchema } from "../../../common/datetime.js";
import {
  AI_SUGGESTION_ANALYSIS_STATES,
  AI_SUGGESTION_STATUSES,
  SUGGESTION_ACTIONS,
} from "../../../vocabulary/ai.constants.js";
import { dayOfWeekSchema } from "../../todo/v1/todo.common.js";

export const suggestionStatusSchema = z.enum(AI_SUGGESTION_STATUSES);

// 서버가 상태를 더해도 출시 앱의 목록 파싱이 깨지지 않게 모르는 값은 UNKNOWN으로 읽는다
export const suggestionAnalysisStateSchema = z
  .union([z.enum(AI_SUGGESTION_ANALYSIS_STATES), z.literal("UNKNOWN")])
  .catch("UNKNOWN");

export const suggestionAnalysisSchema = z.object({
  state: suggestionAnalysisStateSchema.meta({
    description: "제안 화면 상태. 앱은 이 값 하나로 카드를 고른다",
  }),
  canRequestNow: z.boolean().meta({
    description: "지금 분석 받기를 보일지. WAITING_FOR_NEXT_RUN이고 기능이 켜졌을 때만 true",
  }),
  nextAnalysisAt: datetimeSchema.meta({
    description:
      "다음 자동 분석 순간. 저장 시간대의 다음 09:00 뒤 첫 매시 실행이고, 오늘 이미 분석을 요청했다면 내일 그 시각",
  }),
});

export type SuggestionAnalysis = z.infer<typeof suggestionAnalysisSchema>;

export const suggestionEvidenceSchema = z.object({
  recordedCount: z.int().positive().meta({ description: "기간 안에 이 할 일을 적은 횟수" }),
  completedCount: z.int().nonnegative().meta({ description: "그중 끝낸 횟수(recordedCount 이하)" }),
  periodDays: z.int().positive().meta({ description: "근거를 센 기간(일). 지금은 14" }),
});

export type SuggestionEvidence = z.infer<typeof suggestionEvidenceSchema>;

export const recurringSuggestionSchema = z.object({
  id: z.number(),
  title: z.string(),
  daysOfWeek: z.array(dayOfWeekSchema),
  scheduledTime: z.string().nullable(),
  confidence: z.number(),
  reason: z.string(),
  status: suggestionStatusSchema,
  expiresAt: datetimeSchema,
  createdAt: datetimeSchema,
  suggestedCategoryId: z.int().positive().nullable(),
  evidence: suggestionEvidenceSchema
    .nullable()
    .optional()
    .meta({ description: "제안 근거. 1.16.0 전에 만든 제안은 null" }),
});

export type RecurringSuggestion = z.infer<typeof recurringSuggestionSchema>;

export const suggestionListResponseSchema = z.object({
  suggestions: z.array(recurringSuggestionSchema),
  analysis: suggestionAnalysisSchema
    .optional()
    .meta({ description: "분석 상태. 1.16.0 서버부터 항상 온다" }),
});

export type SuggestionListResponse = z.infer<typeof suggestionListResponseSchema>;

export const suggestionAnalysisResponseSchema = z.object({ analysis: suggestionAnalysisSchema });

export type SuggestionAnalysisResponse = z.infer<typeof suggestionAnalysisResponseSchema>;

// 제안 액션 (수락/거절)

export const suggestionActionSchema = z.object({
  action: z.enum(SUGGESTION_ACTIONS),
  categoryId: z.int().positive().optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

export type SuggestionAction = z.infer<typeof suggestionActionSchema>;

export const suggestionActionResponseSchema = z.object({
  message: z.string(),
  suggestion: recurringSuggestionSchema,
  createdTodosCount: z.int().nonnegative().optional(),
});

export type SuggestionActionResponse = z.infer<typeof suggestionActionResponseSchema>;

export const suggestionIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive()
    .meta({ description: "AI 제안 고유 ID (양의 정수, 예: 1)" }),
});

export type SuggestionIdParam = z.infer<typeof suggestionIdParamSchema>;
