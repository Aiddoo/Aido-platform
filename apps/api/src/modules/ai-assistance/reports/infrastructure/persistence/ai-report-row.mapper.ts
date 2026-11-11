import {
  categoryBreakdownItemSchema,
  dayPatternItemSchema,
  reportStatsSchema,
  timePatternItemSchema,
} from "@aido/api";
import { z } from "zod";

import type { aiReport } from "#api/platform/database/schema/ai-assistance.schema";
import { toSupportedLocale } from "#api/shared/domain/locale";

import { AiReport } from "../../domain/ai-report.aggregate.js";
import { REPORT_CONTENT_SOURCES } from "../../domain/ai-report.constants.js";

type AiReportRow = typeof aiReport.$inferSelect;
type AiReportInsertRow = typeof aiReport.$inferInsert;

const DEFAULT_STATS = {
  totalTodos: 0,
  completedTodos: 0,
  completionRate: 0,
  prevCompletionRate: null,
  streakDays: 0,
} as const;

const contentSourceSchema = z.enum(REPORT_CONTENT_SOURCES);

// jsonb 칸이 계약 모양과 다르면 옛 행도 읽히도록 빈 값으로 둔다
function parseArray<T>(schema: z.ZodType<T[]>, raw: unknown): T[] {
  const result = schema.safeParse(raw);
  return result.success ? result.data : [];
}

export function toAiReport(row: AiReportRow): AiReport {
  const stats = reportStatsSchema.safeParse(row.stats);
  const contentSource = contentSourceSchema.safeParse(row.contentSource);
  return AiReport.reconstitute({
    id: row.id,
    userId: row.userId,
    type: row.type,
    year: row.year,
    period: row.period,
    stats: stats.success ? stats.data : { ...DEFAULT_STATS },
    categoryBreakdown: parseArray(z.array(categoryBreakdownItemSchema), row.categoryBreakdown),
    dayPatterns: parseArray(z.array(dayPatternItemSchema), row.dayPatterns),
    timePatterns: parseArray(z.array(timePatternItemSchema), row.timePatterns),
    aiSummary: row.aiSummary,
    aiTips: parseArray(z.array(z.string()), row.aiTips),
    locale: toSupportedLocale(row.locale),
    hasActivity: row.hasActivity,
    generatedAt: row.generatedAt,
    contentSource: contentSource.success ? contentSource.data : null,
    promptVersion: row.promptVersion,
  });
}

export function toAiReportRow(report: AiReport): AiReportInsertRow {
  return report.toPrimitives();
}
