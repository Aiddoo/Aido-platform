import {
  aiReportSchema,
  recurringSuggestionSchema,
  reportStatusSchema,
  reportTypeSchema,
  suggestionActionSchema,
} from '@aido/api';
import type { FeatureQuota } from '@src/features/subscription/domains/entitlement.model';
import type { VoicePlan } from '@src/features/voice/domains/voice-plan.model';
import { z } from 'zod';

export type ReportType = z.infer<typeof reportTypeSchema>;

export const aiReportModelSchema = aiReportSchema.extend({ generatedAt: z.date() });
export type AiReport = z.infer<typeof aiReportModelSchema>;

export const reportStatusModelSchema = reportStatusSchema.extend({
  nextWeeklyAt: z.date(),
  nextMonthlyAt: z.date(),
  latestWeekly: aiReportModelSchema.nullable(),
  latestMonthly: aiReportModelSchema.nullable(),
});
export type ReportStatus = z.infer<typeof reportStatusModelSchema>;

export const getAiReportsParamsSchema = z.object({
  type: reportTypeSchema.optional(),
  limit: z.number().int().positive().optional(),
});
export type GetAiReportsParams = z.infer<typeof getAiReportsParamsSchema>;

export const aiSuggestionModelSchema = recurringSuggestionSchema.extend({
  expiresAt: z.date(),
  createdAt: z.date(),
});
export type AiSuggestion = z.infer<typeof aiSuggestionModelSchema>;

export const aiSuggestionActionInputSchema = suggestionActionSchema;
export type AiSuggestionActionInput = z.infer<typeof aiSuggestionActionInputSchema>;

export const aiSuggestionActionResultSchema = z.object({
  message: z.string(),
  suggestion: aiSuggestionModelSchema,
  createdTodosCount: z.number().optional(),
});
export type AiSuggestionActionResult = z.infer<typeof aiSuggestionActionResultSchema>;

/** 메모 정리 결과. 계획과, 이 요청을 반영한 AI 할 일 만들기 한도(1.15.0 이전 서버는 보내지 않아 null) */
export interface ParsedMemoPlan {
  plan: VoicePlan;
  featureQuota: FeatureQuota | null;
}
