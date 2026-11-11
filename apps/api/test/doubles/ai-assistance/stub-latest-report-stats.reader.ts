import { LatestReportStatsReaderPort } from "#api/modules/ai-assistance/reports/application/ports/latest-report-stats.reader.port";
import type { ReportStats } from "#api/modules/ai-assistance/reports/domain/ai-report.constants";

export class StubLatestReportStatsReader extends LatestReportStatsReaderPort {
  stats: ReportStats | null = null;

  async findLatestWeekly(): Promise<ReportStats | null> {
    return this.stats;
  }
}
