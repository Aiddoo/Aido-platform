import { Inject, Injectable } from "@nestjs/common";

import {
  LATEST_REPORT_STATS_READER,
  type LatestReportStatsReaderPort,
} from "../../../reports/ai-assistance-reports.public.js";
import type {
  WeeklyReportReaderPort,
  WeeklyReportView,
} from "../../application/ports/weekly-report.reader.port.js";

/**
 * WeeklyReportReaderPort의 어댑터.
 *
 * ai-report 모듈의 Facade로 위임하여 최신 WEEKLY 보고서 통계를 읽는다.
 */
@Injectable()
export class WeeklyReportReaderAdapter implements WeeklyReportReaderPort {
  readonly #latestReportStatsReader: LatestReportStatsReaderPort;

  constructor(
    @Inject(LATEST_REPORT_STATS_READER)
    latestReportStatsReader: LatestReportStatsReaderPort,
  ) {
    this.#latestReportStatsReader = latestReportStatsReader;
  }

  async findLatestWeekly(userId: string): Promise<WeeklyReportView | null> {
    const stats = await this.#latestReportStatsReader.findLatestWeekly(userId);
    if (stats == null) {
      return null;
    }
    return { stats };
  }
}
