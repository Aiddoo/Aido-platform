import { z } from "zod";

import { dateSchema, datetimeSchema } from "../../../common/datetime.js";
import {
  AI_REPORT_CONTENT_SOURCES,
  AI_REPORT_PAGE_SIZE,
  AI_REPORT_TYPES,
} from "../../../vocabulary/ai.constants.js";
import { dayOfWeekSchema } from "../../todo/v1/todo.common.js";

export const reportStatsSchema = z.object({
  totalTodos: z.int().nonnegative(),
  completedTodos: z.int().nonnegative(),
  completionRate: z.number().min(0).max(100),
  prevCompletionRate: z.number().min(0).max(100).nullable(),
  streakDays: z.int().nonnegative(),
});

export const categoryBreakdownItemSchema = z.object({
  name: z.string(),
  color: z.string(),
  total: z.int().nonnegative(),
  completed: z.int().nonnegative(),
  rate: z.number().min(0).max(100),
});

export const dayPatternItemSchema = z.object({
  day: dayOfWeekSchema,
  total: z.int().nonnegative(),
  completed: z.int().nonnegative(),
  rate: z.number().min(0).max(100),
});

export const timePatternItemSchema = z.object({
  hour: z.int().min(0).max(23),
  count: z.int().nonnegative(),
});

export const dailyCompletionItemSchema = z.object({
  date: dateSchema,
  total: z.int().nonnegative(),
  completed: z.int().nonnegative(),
});

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
  stats: reportStatsSchema.extend({
    perfectDays: z.int().nonnegative().nullable().meta({
      description:
        "기간에서 할 일이 하나 이상이고 모두 끝낸 날 수(달력 물고기와 같은 규칙). 날마다 기록이 없는 1.16.0 전 리포트는 null",
    }),
  }),
  categoryBreakdown: z.array(categoryBreakdownItemSchema),
  dayPatterns: z.array(dayPatternItemSchema),
  timePatterns: z.array(timePatternItemSchema).meta({
    description: "끝낸 할 일이 있는 시간대. 많이 끝낸 시간부터, 같은 수면 이른 시간부터",
  }),
  peakHour: z.int().min(0).max(23).nullable().meta({
    description: "주로 끝낸 시간(0~23). 같은 수면 이른 시간이고 끝낸 할 일이 없으면 null",
  }),
  aiSummary: z.string(),
  aiTips: z.array(z.string()),
  hasActivity: z.boolean(),
  generatedAt: datetimeSchema,
  dailyCompletions: z.array(dailyCompletionItemSchema).nullable().optional().meta({
    description: "기간의 날마다 할 일 수와 끝낸 수(YYYY-MM-DD, 빈 날은 0). 1.16.0 전 리포트는 null",
  }),
  aiContentSource: z.enum(AI_REPORT_CONTENT_SOURCES).optional().meta({
    description:
      "aiSummary·aiTips를 쓴 곳. AI는 모델, TEMPLATE은 AI 없이 통계로 채운 글이거나 출처를 남기기 전(2026-10-25 전) 리포트",
  }),
});

export type AiReport = z.infer<typeof aiReportSchema>;

export const aiReportResponseSchema = z.object({
  report: aiReportSchema,
});

export const aiReportListResponseSchema = z.object({
  reports: z.array(aiReportSchema),
});

// 리포트 상태 (다음 리포트 예정일)

export const reportStatusSchema = z.object({
  nextWeeklyAt: datetimeSchema,
  nextMonthlyAt: datetimeSchema,
  daysUntilWeekly: z.int().nonnegative(),
  daysUntilMonthly: z.int().nonnegative(),
  latestWeekly: aiReportSchema.nullable(),
  latestMonthly: aiReportSchema.nullable(),
});

export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const reportStatusResponseSchema = z.object({
  status: reportStatusSchema,
});

export const getAiReportsQuerySchema = z.object({
  type: reportTypeSchema
    .optional()
    .meta({ description: "리포트 종류 (WEEKLY | MONTHLY, 생략 시 전체)" }),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(AI_REPORT_PAGE_SIZE.MAX)
    .default(AI_REPORT_PAGE_SIZE.DEFAULT)
    .meta({
      description: `페이지 크기 (1-${AI_REPORT_PAGE_SIZE.MAX}, 기본값: ${AI_REPORT_PAGE_SIZE.DEFAULT})`,
    }),
});

export const aiReportIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 리포트 ID입니다")
    .meta({ description: "AI 리포트 고유 ID (양의 정수, 예: 1)" }),
});
