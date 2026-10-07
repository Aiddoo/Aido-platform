import type { AiReport as AiReportView } from "@aido/api";

import type { AiReport } from "../../../domain/entities/reports/ai-report.entity.js";
import { computeDateRange } from "../../../domain/services/reports/report-period.js";
import { computePeriodLabel } from "./report-period-label.js";

export function toAiReportView(report: AiReport): AiReportView {
  const snapshot = report.snapshot;
  return {
    id: snapshot.id,
    type: snapshot.type,
    year: snapshot.year,
    period: snapshot.period,
    periodLabel: computePeriodLabel(snapshot.type, snapshot.year, snapshot.period, snapshot.locale),
    dateRange: computeDateRange(snapshot.type, snapshot.year, snapshot.period),
    stats: { ...snapshot.stats },
    categoryBreakdown: snapshot.categoryBreakdown.map((item) => ({ ...item })),
    dayPatterns: snapshot.dayPatterns.map((item) => ({ ...item })),
    timePatterns: snapshot.timePatterns.map((item) => ({ ...item })),
    aiSummary: snapshot.aiSummary,
    aiTips: [...snapshot.aiTips],
    hasActivity: snapshot.hasActivity,
    generatedAt: snapshot.generatedAt.toISOString(),
  };
}
