import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AiReportRepositoryPort } from "../../application/ports/ai-report.repository.port.js";
import { LatestReportStatsReaderPort } from "../../application/ports/latest-report-stats.reader.port.js";
import type { ReportStats } from "../../domain/ai-report.constants.js";

@Injectable()
export class LatestReportStatsReaderAdapter extends LatestReportStatsReaderPort {
  readonly #aiReportRepository: Pick<AiReportRepositoryPort, "findLatest">;

  constructor(aiReportRepository: AiReportRepositoryPort) {
    super();
    this.#aiReportRepository = aiReportRepository;
  }

  async findLatestWeekly(userId: UserId): Promise<ReportStats | null> {
    const latestReport = await this.#aiReportRepository.findLatest(userId, "WEEKLY");
    return latestReport?.stats ?? null;
  }
}
