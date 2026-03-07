import {
  aiReportSchema,
  recurringSuggestionSchema,
  reportStatusSchema,
  reportTypeSchema,
  suggestionActionResponseSchema,
  suggestionActionSchema,
} from '@aido/validators';
import { z } from 'zod';

export const aiReportModelSchema = aiReportSchema.extend({
  generatedAt: z.coerce.date(),
});
export type AiReport = z.infer<typeof aiReportModelSchema>;

export const reportStatusModelSchema = reportStatusSchema.extend({
  nextWeeklyAt: z.coerce.date(),
  nextMonthlyAt: z.coerce.date(),
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
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
});
export type AiSuggestion = z.infer<typeof aiSuggestionModelSchema>;

export const aiSuggestionActionInputSchema = suggestionActionSchema;
export type AiSuggestionActionInput = z.infer<typeof aiSuggestionActionInputSchema>;

export const aiSuggestionActionResultSchema = suggestionActionResponseSchema.extend({
  suggestion: aiSuggestionModelSchema,
});
export type AiSuggestionActionResult = z.infer<typeof aiSuggestionActionResultSchema>;
