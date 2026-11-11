import { z } from "zod";

import { dateSchema, datetimeSchema } from "../../../common/datetime.js";
import { AI_REPORT_TYPES } from "../../../vocabulary/ai.constants.js";
import { dayOfWeekSchema } from "../../todo/v1/todo.common.js";

export const reportStatsSchema = z.object({
  totalTodos: z.number().int().nonnegative(),
  completedTodos: z.number().int().nonnegative(),
  completionRate: z.number().min(0).max(100),
  prevCompletionRate: z.number().min(0).max(100).nullable(),
  streakDays: z.number().int().nonnegative(),
});

export type ReportStats = z.infer<typeof reportStatsSchema>;

export const categoryBreakdownItemSchema = z.object({
  name: z.string(),
  color: z.string(),
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  rate: z.number().min(0).max(100),
});

export type CategoryBreakdownItem = z.infer<typeof categoryBreakdownItemSchema>;

export const dayPatternItemSchema = z.object({
  day: dayOfWeekSchema,
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  rate: z.number().min(0).max(100),
});

export type DayPatternItem = z.infer<typeof dayPatternItemSchema>;

export const timePatternItemSchema = z.object({
  hour: z.number().int().min(0).max(23),
  count: z.number().int().nonnegative(),
});

export type TimePatternItem = z.infer<typeof timePatternItemSchema>;

export const reportTypeSchema = z.enum(AI_REPORT_TYPES);

export const aiReportSchema = z.object({
  id: z.number(),
  type: reportTypeSchema,
  year: z.number(),
  period: z.number(),
  periodLabel: z.string(),
  dateRange: z.object({
    startDate: dateSchema,
    endDate: dateSchema,
  }),
  stats: reportStatsSchema,
  categoryBreakdown: z.array(categoryBreakdownItemSchema),
  dayPatterns: z.array(dayPatternItemSchema),
  timePatterns: z.array(timePatternItemSchema),
  aiSummary: z.string(),
  aiTips: z.array(z.string()),
  hasActivity: z.boolean(),
  generatedAt: datetimeSchema,
});

export type AiReport = z.infer<typeof aiReportSchema>;

export const aiReportResponseSchema = z.object({
  report: aiReportSchema,
});

export type AiReportResponse = z.infer<typeof aiReportResponseSchema>;

export const aiReportListResponseSchema = z.object({
  reports: z.array(aiReportSchema),
});

export type AiReportListResponse = z.infer<typeof aiReportListResponseSchema>;

// 리포트 상태 (다음 리포트 예정일)

export const reportStatusSchema = z.object({
  nextWeeklyAt: datetimeSchema,
  nextMonthlyAt: datetimeSchema,
  daysUntilWeekly: z.number().int().nonnegative(),
  daysUntilMonthly: z.number().int().nonnegative(),
  latestWeekly: aiReportSchema.nullable(),
  latestMonthly: aiReportSchema.nullable(),
});

export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const reportStatusResponseSchema = z.object({
  status: reportStatusSchema,
});

export type ReportStatusResponse = z.infer<typeof reportStatusResponseSchema>;

export const getAiReportsQuerySchema = z.object({
  type: reportTypeSchema.optional().describe("리포트 종류 (WEEKLY | MONTHLY, 생략 시 전체)"),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(50)
    .default(10)
    .describe("페이지 크기 (1-50, 기본값: 10)"),
});

export type GetAiReportsQuery = z.infer<typeof getAiReportsQuerySchema>;

export const aiReportIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 리포트 ID입니다")
    .describe("AI 리포트 고유 ID (양의 정수, 예: 1)"),
});

export type AiReportIdParam = z.infer<typeof aiReportIdParamSchema>;
