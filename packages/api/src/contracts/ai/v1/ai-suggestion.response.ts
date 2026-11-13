import { z } from "zod";

import { dateSchema, datetimeSchema } from "../../../common/datetime.js";
import { AI_SUGGESTION_STATUSES, SUGGESTION_ACTIONS } from "../../../vocabulary/ai.constants.js";
import { dayOfWeekSchema } from "../../todo/v1/todo.common.js";

export const suggestionStatusSchema = z.enum(AI_SUGGESTION_STATUSES);

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
  suggestedCategoryId: z.number().int().positive().nullable(),
});

export type RecurringSuggestion = z.infer<typeof recurringSuggestionSchema>;

export const suggestionListResponseSchema = z.object({
  suggestions: z.array(recurringSuggestionSchema),
});

export type SuggestionListResponse = z.infer<typeof suggestionListResponseSchema>;

// 제안 액션 (수락/거절)

export const suggestionActionSchema = z.object({
  action: z.enum(SUGGESTION_ACTIONS),
  categoryId: z.number().int().positive().optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

export type SuggestionAction = z.infer<typeof suggestionActionSchema>;

export const suggestionActionResponseSchema = z.object({
  message: z.string(),
  suggestion: recurringSuggestionSchema,
  createdTodosCount: z.number().int().nonnegative().optional(),
});

export type SuggestionActionResponse = z.infer<typeof suggestionActionResponseSchema>;

export const suggestionIdParamSchema = z.object({
  id: z.coerce.number().int().positive().describe("AI 제안 고유 ID (양의 정수, 예: 1)"),
});

export type SuggestionIdParam = z.infer<typeof suggestionIdParamSchema>;
