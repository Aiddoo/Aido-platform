import type { AiReport as AiReportResponse, ReportStatus } from "@aido/api/contracts/ai/v1";
import { match } from "ts-pattern";

import { toIsoString } from "#api/shared/domain/time/instant";

import { computePeriodLabel } from "../../../application/messages/report-period-label.messages.js";
import type { ReportStatusReadModel } from "../../../application/read-models/report-status.read-model.js";
import type { AiReport } from "../../../domain/ai-report.aggregate.js";
import type { ReportContentSource } from "../../../domain/ai-reports.constants.js";
import {
  countPerfectDays,
  findPeakHour,
  orderTimePatterns,
} from "../../../domain/report-aggregation.domain-service.js";
import { computeDateRange } from "../../../domain/report-period.domain-service.js";

// 출처 칸이 생기기 전(2026-10-25) 행(null)은 AI 글인지 폴백인지 몰라 AI 코치로 내세우지 않는다
function toAiContentSource(
  contentSource: ReportContentSource | null,
): NonNullable<AiReportResponse["aiContentSource"]> {
  return match(contentSource)
    .with("AI", () => "AI" as const)
    .with("FALLBACK", "TEMPLATE", "NO_AI_CONSENT", null, () => "TEMPLATE" as const)
    .exhaustive();
}

/** `localToday`는 읽는 사용자 시간대의 오늘이다. 주간 라벨이 다른 해의 주면 연도를 붙인다 */
export function toAiReportResponse(
  report: AiReport,
  localToday: Temporal.PlainDate,
): AiReportResponse {
  const primitives = report.toPrimitives();
  return {
    id: primitives.id,
    type: primitives.type,
    year: primitives.year,
    period: primitives.period,
    periodLabel: computePeriodLabel({
      type: primitives.type,
      year: primitives.year,
      period: primitives.period,
      locale: primitives.locale,
      localToday,
    }),
    dateRange: computeDateRange(primitives.type, primitives.year, primitives.period),
    stats: { ...primitives.stats, perfectDays: countPerfectDays(primitives.dailyCompletions) },
    categoryBreakdown: [...primitives.categoryBreakdown],
    dayPatterns: [...primitives.dayPatterns],
    timePatterns: orderTimePatterns(primitives.timePatterns),
    peakHour: findPeakHour(primitives.timePatterns),
    aiSummary: primitives.aiSummary,
    aiTips: [...primitives.aiTips],
    hasActivity: primitives.hasActivity,
    generatedAt: toIsoString(primitives.generatedAt),
    dailyCompletions:
      primitives.dailyCompletions?.map((item) => ({ ...item, date: item.date.toString() })) ?? null,
    aiContentSource: toAiContentSource(primitives.contentSource),
  };
}

export function toReportStatusResponse(status: ReportStatusReadModel): ReportStatus {
  const { latestWeekly, latestMonthly, localToday } = status;
  return {
    nextWeeklyAt: toIsoString(status.nextWeeklyAt),
    nextMonthlyAt: toIsoString(status.nextMonthlyAt),
    daysUntilWeekly: status.daysUntilWeekly,
    daysUntilMonthly: status.daysUntilMonthly,
    latestWeekly: latestWeekly == null ? null : toAiReportResponse(latestWeekly, localToday),
    latestMonthly: latestMonthly == null ? null : toAiReportResponse(latestMonthly, localToday),
  };
}
