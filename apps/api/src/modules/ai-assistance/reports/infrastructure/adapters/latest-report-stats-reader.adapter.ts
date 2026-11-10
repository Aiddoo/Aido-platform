import { Inject, Injectable } from "@nestjs/common";

import {
  AI_REPORT_REPOSITORY,
  type AiReportRepositoryPort,
} from "../../application/ports/ai-report.repository.port.js";
import type { LatestReportStatsReaderPort } from "../../application/ports/latest-report-stats.reader.port.js";

@Injectable()
export class LatestReportStatsReader implements LatestReportStatsReaderPort {
  readonly #aiReportRepository: AiReportRepositoryPort;

  constructor(
    @Inject(AI_REPORT_REPOSITORY)
    aiReportRepository: AiReportRepositoryPort,
  ) {
    this.#aiReportRepository = aiReportRepository;
  }

  async findLatestWeekly(userId: string) {
    const latestReport = await this.#aiReportRepository.findLatest(userId, "WEEKLY");
    return latestReport?.stats ?? null;
  }
}
