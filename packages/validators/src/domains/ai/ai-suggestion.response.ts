import { z } from 'zod';

import { datetimeSchema } from '../../common/datetime';
import { dayOfWeekSchema } from '../todo/todo.common';

// ============================================================================
// AI 반복 제안
// ============================================================================

export const recurringSuggestionSchema = z.object({
  id: z.number().int().describe('제안 ID'),
  title: z.string().describe('제안된 할 일 제목'),
  daysOfWeek: z.array(dayOfWeekSchema).describe('반복 요일'),
  scheduledTime: z.string().nullable().describe('추천 시간 (HH:mm, null = 종일)'),
  confidence: z.number().min(0).max(1).describe('신뢰도 (0-1)'),
  reason: z.string().describe('제안 이유'),
  matchedTodos: z.array(z.string()).describe('매칭된 기존 할 일 제목 목록'),
  status: z.enum(['PENDING', 'ACCEPTED', 'DISMISSED']).describe('제안 상태'),
  expiresAt: datetimeSchema.describe('만료 시각'),
  createdAt: datetimeSchema.describe('생성 시각'),
});

export type RecurringSuggestion = z.infer<typeof recurringSuggestionSchema>;

export const suggestionListResponseSchema = z.object({
  success: z.literal(true).describe('조회 성공 여부 (항상 true)'),
  data: z.array(recurringSuggestionSchema).describe('제안 목록'),
});

export type SuggestionListResponse = z.infer<typeof suggestionListResponseSchema>;

// ============================================================================
// 제안 액션 (수락/거절)
// ============================================================================

export const suggestionActionSchema = z.object({
  action: z.enum(['accept', 'dismiss']).describe('수행할 액션 (accept: 수락, dismiss: 거절)'),
});

export type SuggestionAction = z.infer<typeof suggestionActionSchema>;

export const suggestionActionResponseSchema = z.object({
  success: z.literal(true).describe('처리 성공 여부 (항상 true)'),
  data: z.object({
    id: z.number().int().describe('제안 ID'),
    status: z.enum(['ACCEPTED', 'DISMISSED']).describe('변경된 상태'),
  }),
});

export type SuggestionActionResponse = z.infer<typeof suggestionActionResponseSchema>;

// ============================================================================
// 제안 ID 파라미터
// ============================================================================

export const suggestionIdParamSchema = z.object({
  suggestionId: z.coerce.number().int().positive().describe('제안 ID'),
});

export type SuggestionIdParam = z.infer<typeof suggestionIdParamSchema>;
