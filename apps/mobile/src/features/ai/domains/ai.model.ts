import {
  aiReportSchema,
  parsedMemoDataSchema,
  recurringSuggestionSchema,
  reportStatusSchema,
  reportTypeSchema,
  suggestionActionSchema,
} from '@aido/api';
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

export const parsedMemoResultSchema = parsedMemoDataSchema.extend({
  omittedTodoCount: z.number().int().nonnegative(),
});
export type ParsedMemoResult = z.infer<typeof parsedMemoResultSchema>;
export type ParsedMemoTodo = ParsedMemoResult['todos'][number];
