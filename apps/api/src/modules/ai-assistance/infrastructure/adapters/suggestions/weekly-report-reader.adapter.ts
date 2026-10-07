import { Inject, Injectable } from "@nestjs/common";

import {
  LATEST_REPORT_STATS_READER,
  type LatestReportStatsReaderPort,
} from "#api/modules/ai-assistance/ai-assistance-reports.public";

import type {
  WeeklyReportReaderPort,
  WeeklyReportView,
} from "../../../application/ports/suggestions/weekly-report-reader.port.js";

/**
 * WeeklyReportReaderPort의 어댑터.
 *
 * ai-report 모듈의 Facade로 위임하여 최신 WEEKLY 보고서 통계를 읽는다.
 */
@Injectable()
export class WeeklyReportReaderAdapter implements WeeklyReportReaderPort {
  constructor(
    @Inject(LATEST_REPORT_STATS_READER)
    private readonly latestReportStatsReader: LatestReportStatsReaderPort,
  ) {}

  async findLatestWeekly(userId: string): Promise<WeeklyReportView | null> {
    const stats = await this.latestReportStatsReader.findLatestWeekly(userId);
    if (stats === null) {
      return null;
    }
    return { stats };
  }
}
