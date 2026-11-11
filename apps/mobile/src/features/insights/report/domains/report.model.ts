import { AI_REPORT_TYPES, DAYS_OF_WEEK } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { orderBy } from 'es-toolkit';
import { match } from 'ts-pattern';
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
type DayPatternItem = z.infer<typeof dayPatternItemSchema>;

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

export const reportStatusSchema = z.object({
  daysUntilWeekly: z.int().nonnegative(),
  daysUntilMonthly: z.int().nonnegative(),
});
export type ReportStatus = z.infer<typeof reportStatusSchema>;

// 지난 기간 완료율이 없으면(첫 리포트) 비교할 값이 없다
export function getCompletionRateChange(report: AiReport): number | null {
  const { completionRate, prevCompletionRate } = report.stats;
  return prevCompletionRate != null ? completionRate - prevCompletionRate : null;
}

type CompletionLevel = 'high' | 'medium' | 'low';

const HIGH_COMPLETION_RATE = 80;
const MEDIUM_COMPLETION_RATE = 50;

// 요일 완료율 80% 이상은 높음, 50% 이상은 보통
export function getCompletionLevel(dayPattern: DayPatternItem): CompletionLevel {
  if (dayPattern.rate >= HIGH_COMPLETION_RATE) {
    return 'high';
  }
  if (dayPattern.rate >= MEDIUM_COMPLETION_RATE) {
    return 'medium';
  }
  return 'low';
}

export function getMostActiveHours(report: AiReport, limit: number): TimePatternItem[] {
  return orderBy(report.timePatterns, ['count'], ['desc']).slice(0, limit);
}

export function getDaysUntilReport(status: ReportStatus, type: ReportType): number {
  return match(type)
    .with('WEEKLY', () => status.daysUntilWeekly)
    .with('MONTHLY', () => status.daysUntilMonthly)
    .exhaustive();
}

export const ReportPolicy = {
  getCompletionRateChange,
  getCompletionLevel,
  getMostActiveHours,
} as const;

export const ReportStatusPolicy = {
  getDaysUntilReport,
} as const;
