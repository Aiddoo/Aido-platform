import type { ReportStats } from "@aido/validators";

export const LATEST_REPORT_STATS_READER = Symbol("LATEST_REPORT_STATS_READER");

export interface LatestReportStatsReaderPort {
	findLatestWeekly(userId: string): Promise<ReportStats | null>;
}
