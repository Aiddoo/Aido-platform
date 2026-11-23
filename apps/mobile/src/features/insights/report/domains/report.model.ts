import { AI_REPORT_CONTENT_SOURCES, AI_REPORT_TYPES } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { completionRateSchema } from '@src/shared/domains/completion-rate.model';
import { maxBy, orderBy } from 'es-toolkit';
import { z } from 'zod';

export const reportTypeSchema = z.enum(AI_REPORT_TYPES);
export type ReportType = z.infer<typeof reportTypeSchema>;

const reportStatsSchema = z.object({
  totalTodos: z.int().nonnegative(),
  completedTodos: z.int().nonnegative(),
  completionRate: completionRateSchema,
  prevCompletionRate: completionRateSchema.nullable(),
  streakDays: z.int().nonnegative(),
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
  // 1.16.0 전에 만든 리포트는 날마다의 기록이 없다
  dailyCompletions: z.array(dailyCompletionSchema).nullable(),
  aiSummary: z.string(),
  aiTips: z.array(z.string()),
  aiContentSource: z.enum(AI_REPORT_CONTENT_SOURCES).nullable(),
  hasActivity: z.boolean(),
  generatedAt: instantSchema,
});
export type AiReport = z.infer<typeof aiReportSchema>;

// 지난 기간 완료율이 없으면(첫 리포트) 비교할 값이 없다
export function getCompletionRateChange(report: AiReport): number | null {
  const { completionRate, prevCompletionRate } = report.stats;
  return prevCompletionRate != null ? completionRate - prevCompletionRate : null;
}

// 서버는 많이 끝낸 순으로 보내 같은 수끼리 순서가 정해지지 않으므로 시각 순으로 놓아 이른 시각을 고른다
export function getPeakHour(report: AiReport): number | null {
  const peak = maxBy(orderBy(report.timePatterns, ['hour'], ['asc']), (pattern) => pattern.count);
  if (peak == null || peak.count === 0) {
    return null;
  }
  return peak.hour;
}

export function getPerfectDayCount(report: AiReport): number {
  if (report.dailyCompletions == null) {
    return 0;
  }
  return report.dailyCompletions.filter((day) => 0 < day.total && day.completed === day.total)
    .length;
}

export const ReportPolicy = {
  getCompletionRateChange,
  getPeakHour,
  getPerfectDayCount,
} as const;
