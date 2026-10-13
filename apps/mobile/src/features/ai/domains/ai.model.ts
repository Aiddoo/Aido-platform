import {
  dayOfWeekSchema,
  reportTypeSchema,
  suggestionActionSchema,
  suggestionStatusSchema,
} from '@aido/api';
import { z } from 'zod';

const reportStatsSchema = z.object({
  totalTodos: z.number(),
  completedTodos: z.number(),
  completionRate: z.number(),
  prevCompletionRate: z.number().nullable(),
  streakDays: z.number(),
});

export const aiReportModelSchema = z.object({
  id: z.number(),
  type: reportTypeSchema,
  year: z.number(),
  period: z.number(),
  periodLabel: z.string(),
  dateRange: z.object({ startDate: z.string(), endDate: z.string() }),
  stats: reportStatsSchema,
  categoryBreakdown: z.array(
    z.object({
      name: z.string(),
      color: z.string(),
      total: z.number(),
      completed: z.number(),
      rate: z.number(),
    }),
  ),
  dayPatterns: z.array(
    z.object({ day: dayOfWeekSchema, total: z.number(), completed: z.number(), rate: z.number() }),
  ),
  timePatterns: z.array(z.object({ hour: z.number(), count: z.number() })),
  aiSummary: z.string(),
  aiTips: z.array(z.string()),
  hasActivity: z.boolean(),
  generatedAt: z.date(),
});
export type AiReport = z.infer<typeof aiReportModelSchema>;

export const reportStatusModelSchema = z.object({
  nextWeeklyAt: z.date(),
  nextMonthlyAt: z.date(),
  daysUntilWeekly: z.number(),
  daysUntilMonthly: z.number(),
  latestWeekly: aiReportModelSchema.nullable(),
  latestMonthly: aiReportModelSchema.nullable(),
});
export type ReportStatus = z.infer<typeof reportStatusModelSchema>;

export const getAiReportsParamsSchema = z.object({
  type: reportTypeSchema.optional(),
  limit: z.number().int().positive().optional(),
});
export type GetAiReportsParams = z.infer<typeof getAiReportsParamsSchema>;

export const aiSuggestionModelSchema = z.object({
  id: z.number(),
  title: z.string(),
  daysOfWeek: z.array(dayOfWeekSchema),
  scheduledTime: z.string().nullable(),
  confidence: z.number(),
  reason: z.string(),
  status: suggestionStatusSchema,
  expiresAt: z.date(),
  createdAt: z.date(),
  suggestedCategoryId: z.number().nullable(),
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

export const parsedMemoTodoSchema = z.object({
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  scheduledTime: z.string().nullable(),
  isAllDay: z.boolean(),
  isRecurring: z.boolean(),
  recurrence: z.object({ daysOfWeek: z.array(dayOfWeekSchema), endDate: z.string() }).nullable(),
  categoryId: z.number(),
  items: z.array(z.object({ title: z.string() })),
});
export type ParsedMemoTodo = z.infer<typeof parsedMemoTodoSchema>;

export const parsedMemoResultSchema = z.object({ todos: z.array(parsedMemoTodoSchema) });
export type ParsedMemoResult = z.infer<typeof parsedMemoResultSchema>;
