import type { AiReport as AiReportDto } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type AiReportRepositoryPort } from "../../ports/reports/ai-report.repository.port.js";

interface GetReportByIdDependencies {
  readonly aiReportRepository: AiReportRepositoryPort;
  readonly entitlementService: EntitlementService;
}

export class GetReportById {
  readonly #dependencies: GetReportByIdDependencies;

  constructor(dependencies: GetReportByIdDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, id: number): Promise<AiReportDto> {
    const hasPremium = await this.#dependencies.entitlementService.hasPremiumAccess(userId);
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
