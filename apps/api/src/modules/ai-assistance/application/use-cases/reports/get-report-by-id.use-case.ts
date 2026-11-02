import type { AiReport as AiReportDto } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import {
  assertEntitled,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type AiReportRepositoryPort } from "../../ports/reports/ai-report.repository.port.js";
import { toAiReportView } from "../../read-models/reports/ai-report.read-model.js";

interface GetReportByIdDependencies {
  readonly aiReportRepository: Pick<AiReportRepositoryPort, "findByIdAndUserId">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
}

export class GetReportById {
  readonly #dependencies: GetReportByIdDependencies;

  constructor(dependencies: GetReportByIdDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, id: number): Promise<AiReportDto> {
    await assertEntitled(this.#dependencies.entitlementReader, userId, "AI_REPORT");

    const report = await this.#dependencies.aiReportRepository.findByIdAndUserId(id, userId);

    if (report == null) {
      throw new ApplicationException(ErrorCode.AI_1304, { reportId: id });
    }

    return toAiReportView(report);
  }
}
