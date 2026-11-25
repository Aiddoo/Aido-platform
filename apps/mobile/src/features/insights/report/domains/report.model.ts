import { AI_REPORT_CONTENT_SOURCES, AI_REPORT_TYPES } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { completionRateSchema } from '@src/shared/domains/completion-rate.model';
import { z } from 'zod';

export const reportTypeSchema = z.enum(AI_REPORT_TYPES);
export type ReportType = z.infer<typeof reportTypeSchema>;

const reportStatsSchema = z.object({
  totalTodos: z.int().nonnegative(),
  completedTodos: z.int().nonnegative(),
  completionRate: completionRateSchema,
  prevCompletionRate: completionRateSchema.nullable(),
  streakDays: z.int().nonnegative(),
  // 1.16.0 전에 만든 리포트는 날마다의 기록이 없어 서버가 세지 못한다
  perfectDays: z.int().nonnegative().nullable(),
});

const categoryBreakdownItemSchema = z.object({
  name: z.string(),
  color: z.string(),
  total: z.int().nonnegative(),
  completed: z.int().nonnegative(),
  rate: completionRateSchema,
});

const timePatternItemSchema = z.object({
  hour: z.int().min(0).max(23),
  count: z.int().nonnegative(),
});

const dailyCompletionSchema = z.object({
  date: dateKeySchema,
  total: z.int().nonnegative(),
  completed: z.int().nonnegative(),
});
export type DailyCompletion = z.infer<typeof dailyCompletionSchema>;

export const aiReportSchema = z.object({
  id: z.number(),
  type: reportTypeSchema,
  year: z.number(),
  period: z.number(),
  dateRange: z.object({ startDate: dateKeySchema, endDate: dateKeySchema }),
  stats: reportStatsSchema,
  categoryBreakdown: z.array(categoryBreakdownItemSchema),
  timePatterns: z.array(timePatternItemSchema),
  // 끝낸 할 일이 없으면 null이다
  peakHour: z.int().min(0).max(23).nullable(),
  // 1.16.0 전에 만든 리포트는 날마다의 기록이 없다
  dailyCompletions: z.array(dailyCompletionSchema).nullable(),
  aiSummary: z.string(),
  aiTips: z.array(z.string()),
  aiContentSource: z.enum(AI_REPORT_CONTENT_SOURCES).nullable(),
  hasActivity: z.boolean(),
  generatedAt: instantSchema,
});
export type AiReport = z.infer<typeof aiReportSchema>;

export const ReportPolicy = {
  // 지난 기간 완료율이 없으면(첫 리포트) 비교할 값이 없다
  findCompletionRateChange(report: AiReport): number | null {
    const { completionRate, prevCompletionRate } = report.stats;
    return prevCompletionRate != null ? completionRate - prevCompletionRate : null;
  },
};
