import { Inject, Injectable } from "@nestjs/common";

import {
  AI_REPORT_REPOSITORY,
  type AiReportRepositoryPort,
} from "../../application/ports/ai-report.repository.port.js";
import type { LatestReportStatsReaderPort } from "../../application/ports/latest-report-stats.reader.port.js";

@Injectable()
export class LatestReportStatsReader implements LatestReportStatsReaderPort {
  constructor(
    @Inject(AI_REPORT_REPOSITORY)
    private readonly aiReportRepository: AiReportRepositoryPort,
  ) {}

  async findLatestWeekly(userId: string) {
    const latestReport = await this.aiReportRepository.findLatest(userId, "WEEKLY");
    return latestReport?.stats ?? null;
  }
}
