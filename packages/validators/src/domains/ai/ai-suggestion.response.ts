import { z } from 'zod';

import { dateSchema, datetimeSchema } from '../../common/datetime';
import { dayOfWeekSchema } from '../todo/todo.common';

// ============================================================================
// AI 반복 제안
// ============================================================================

export const suggestionStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DISMISSED']);

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
});

export type RecurringSuggestion = z.infer<typeof recurringSuggestionSchema>;

export const suggestionListResponseSchema = z.object({
  suggestions: z.array(recurringSuggestionSchema),
});

export type SuggestionListResponse = z.infer<typeof suggestionListResponseSchema>;

// ============================================================================
// 제안 액션 (수락/거절)
// ============================================================================

export const suggestionActionSchema = z.object({
  action: z.enum(['accept', 'dismiss']),
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

// ============================================================================
// 제안 ID 파라미터
// ============================================================================

export const suggestionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type SuggestionIdParam = z.infer<typeof suggestionIdParamSchema>;
