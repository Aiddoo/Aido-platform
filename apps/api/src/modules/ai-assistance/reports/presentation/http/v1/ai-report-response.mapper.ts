import type { AiReport as AiReportResponse, ReportStatus } from "@aido/api";

import { toIsoString } from "#api/shared/domain/time/instant";

import { computePeriodLabel } from "../../../application/messages/report-period-label.messages.js";
import type { ReportStatusReadModel } from "../../../application/read-models/report-status.read-model.js";
import type { AiReport } from "../../../domain/ai-report.aggregate.js";
import { computeDateRange } from "../../../domain/report-period.domain-service.js";

export function toAiReportResponse(report: AiReport): AiReportResponse {
  const primitives = report.toPrimitives();
  return {
    id: primitives.id,
    type: primitives.type,
    year: primitives.year,
    period: primitives.period,
    periodLabel: computePeriodLabel(
      primitives.type,
      primitives.year,
      primitives.period,
      primitives.locale,
    ),
    dateRange: computeDateRange(primitives.type, primitives.year, primitives.period),
    stats: primitives.stats,
    categoryBreakdown: [...primitives.categoryBreakdown],
    dayPatterns: [...primitives.dayPatterns],
    timePatterns: [...primitives.timePatterns],
    aiSummary: primitives.aiSummary,
    aiTips: [...primitives.aiTips],
    hasActivity: primitives.hasActivity,
    generatedAt: toIsoString(primitives.generatedAt),
  };
}

export function toReportStatusResponse(status: ReportStatusReadModel): ReportStatus {
  return {
    nextWeeklyAt: toIsoString(status.nextWeeklyAt),
    nextMonthlyAt: toIsoString(status.nextMonthlyAt),
    daysUntilWeekly: status.daysUntilWeekly,
    daysUntilMonthly: status.daysUntilMonthly,
    latestWeekly: status.latestWeekly == null ? null : toAiReportResponse(status.latestWeekly),
    latestMonthly: status.latestMonthly == null ? null : toAiReportResponse(status.latestMonthly),
  };
}
