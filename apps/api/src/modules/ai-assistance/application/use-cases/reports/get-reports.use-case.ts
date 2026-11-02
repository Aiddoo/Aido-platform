import type { AiReport as AiReportDto } from "@aido/api";

import {
  assertEntitled,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";

import type { ReportType } from "../../../domain/types/reports/ai-report.types.js";
import { type AiReportRepositoryPort } from "../../ports/reports/ai-report.repository.port.js";
import { toAiReportView } from "../../read-models/reports/ai-report.read-model.js";

interface GetReportsDependencies {
  readonly aiReportRepository: Pick<AiReportRepositoryPort, "findMany">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
}

export class GetReports {
  readonly #dependencies: GetReportsDependencies;

  constructor(dependencies: GetReportsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    userId: string,
    params: { type?: ReportType; limit: number },
  ): Promise<AiReportDto[]> {
    await assertEntitled(this.#dependencies.entitlementReader, userId, "AI_REPORT");

    const reports = await this.#dependencies.aiReportRepository.findMany({
      userId,
      type: params.type,
      limit: params.limit,
    });

    return reports.map((report) => toAiReportView(report));
  }
}
