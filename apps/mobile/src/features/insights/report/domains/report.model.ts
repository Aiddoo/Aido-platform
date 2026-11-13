import { AI_REPORT_TYPES, DAYS_OF_WEEK } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { orderBy } from 'es-toolkit';
import { z } from 'zod';

export const reportTypeSchema = z.enum(AI_REPORT_TYPES);
export type ReportType = z.infer<typeof reportTypeSchema>;

const reportStatsSchema = z.object({
  totalTodos: z.int().nonnegative(),
  completedTodos: z.int().nonnegative(),
  completionRate: z.number().min(0).max(100),
  prevCompletionRate: z.number().min(0).max(100).nullable(),
  streakDays: z.int().nonnegative(),
});

const categoryBreakdownItemSchema = z.object({
  name: z.string(),
  color: z.string(),
  total: z.int().nonnegative(),
  completed: z.int().nonnegative(),
  rate: z.number().min(0).max(100),
});

const dayPatternItemSchema = z.object({
  day: z.enum(DAYS_OF_WEEK),
  total: z.int().nonnegative(),
  completed: z.int().nonnegative(),
  rate: z.number().min(0).max(100),
});
export type DayPatternItem = z.infer<typeof dayPatternItemSchema>;

const timePatternItemSchema = z.object({
  hour: z.int().min(0).max(23),
  count: z.int().nonnegative(),
});
export type TimePatternItem = z.infer<typeof timePatternItemSchema>;

export const aiReportSchema = z.object({
  id: z.number(),
  type: reportTypeSchema,
  year: z.number(),
  period: z.number(),
  dateRange: z.object({ startDate: dateKeySchema, endDate: dateKeySchema }),
  stats: reportStatsSchema,
  categoryBreakdown: z.array(categoryBreakdownItemSchema),
  dayPatterns: z.array(dayPatternItemSchema),
  timePatterns: z.array(timePatternItemSchema),
  aiSummary: z.string(),
  aiTips: z.array(z.string()),
  hasActivity: z.boolean(),
  generatedAt: instantSchema,
});
export type AiReport = z.infer<typeof aiReportSchema>;

// 지난 기간 완료율이 없으면(첫 리포트) 비교할 값이 없다
export function getCompletionRateChange(report: AiReport): number | null {
  const { completionRate, prevCompletionRate } = report.stats;
  return prevCompletionRate != null ? completionRate - prevCompletionRate : null;
}

export function getMostActiveHours(report: AiReport, limit: number): TimePatternItem[] {
  return orderBy(report.timePatterns, ['count'], ['desc']).slice(0, limit);
}

export const ReportPolicy = {
  getCompletionRateChange,
  getMostActiveHours,
} as const;
