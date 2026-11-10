import type { ReportStats } from "../../domain/ai-report.constants.js";

/** 반복 제안 문맥에 넣는 최신 주간 리포트 통계 */
export abstract class LatestReportStatsReaderPort {
  abstract findLatestWeekly(userId: string): Promise<ReportStats | null>;
}
