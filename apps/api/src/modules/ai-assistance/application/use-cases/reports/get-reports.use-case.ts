import type { AiReport as AiReportDto } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { ReportType } from "../../../domain/types/reports/ai-report.types.js";
import { type AiReportRepositoryPort } from "../../ports/reports/ai-report.repository.port.js";

interface GetReportsDependencies {
  readonly aiReportRepository: AiReportRepositoryPort;
  readonly entitlementReader: Pick<EntitlementReaderPort, "hasPremiumAccess">;
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
    const hasPremium = await this.#dependencies.entitlementReader.hasPremiumAccess(userId);
    if (!hasPremium) {
      throw new ApplicationException(ErrorCode.AI_1308);
    }

    const reports = await this.#dependencies.aiReportRepository.findMany({
      userId,
      type: params.type,
      limit: params.limit,
    });

    return reports.map((report) => report.toView());
  }
}
