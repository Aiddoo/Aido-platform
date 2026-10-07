import type { AiReport as AiReportDto } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type AiReportRepositoryPort } from "../../ports/reports/ai-report.repository.port.js";

interface GetReportByIdDependencies {
  readonly aiReportRepository: AiReportRepositoryPort;
  readonly entitlementReader: Pick<EntitlementReaderPort, "hasPremiumAccess">;
}

export class GetReportById {
  readonly #dependencies: GetReportByIdDependencies;

  constructor(dependencies: GetReportByIdDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, id: number): Promise<AiReportDto> {
    const hasPremium = await this.#dependencies.entitlementReader.hasPremiumAccess(userId);
    if (!hasPremium) {
      throw new ApplicationException(ErrorCode.AI_1308);
    }

    const report = await this.#dependencies.aiReportRepository.findByIdAndUserId(id, userId);

    if (!report) {
      throw new ApplicationException(ErrorCode.AI_1304, { reportId: id });
    }

    return report.toView();
  }
}
