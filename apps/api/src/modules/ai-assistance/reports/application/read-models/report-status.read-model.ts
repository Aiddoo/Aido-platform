import type { AiReport } from "../../domain/ai-report.aggregate.js";

/** 다음 리포트를 확인할 수 있는 시각(사용자 로컬 기준)과 최신 리포트 */
export interface ReportStatusReadModel {
  readonly nextWeeklyAt: Temporal.Instant;
  readonly nextMonthlyAt: Temporal.Instant;
  readonly daysUntilWeekly: number;
  readonly daysUntilMonthly: number;
  readonly latestWeekly: AiReport | null;
  readonly latestMonthly: AiReport | null;
  /** 사용자 시간대의 오늘. 기간 라벨의 연도를 정한다 */
  readonly localToday: Temporal.PlainDate;
}
