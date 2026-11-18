import type { AiReport } from "../../domain/ai-report.aggregate.js";

export interface ReportListReadModel {
  readonly reports: readonly AiReport[];
  /** 사용자 저장 시간대의 오늘. 기간 라벨의 연도를 정한다 */
  readonly localToday: Temporal.PlainDate;
}
