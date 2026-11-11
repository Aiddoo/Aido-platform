import {
  assertEntitled,
  type EntitlementReaderPort,
} from "#api/modules/access/entitlements/access-entitlements.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AiReportId } from "../../domain/ai-report-id.vo.js";
import type { AiReport } from "../../domain/ai-report.aggregate.js";
import type { AiReportRepositoryPort } from "../ports/ai-report.repository.port.js";
import { aiReportNotFound } from "../reports.errors.js";

export interface GetReportByIdQuery {
  readonly userId: string;
  readonly reportId: number;
}

interface GetReportByIdDependencies {
  readonly aiReportRepository: Pick<AiReportRepositoryPort, "findByIdAndUserId">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
}

export class GetReportByIdUseCase {
  readonly #dependencies: GetReportByIdDependencies;

  constructor(dependencies: GetReportByIdDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetReportByIdQuery): Promise<AiReport> {
    await assertEntitled(
      this.#dependencies.entitlementReader,
      UserId.reconstitute(query.userId),
      "AI_REPORT",
    );

    const reportId = AiReportId.reconstitute(query.reportId);
    const report = await this.#dependencies.aiReportRepository.findByIdAndUserId(
      reportId,
      UserId.reconstitute(query.userId),
    );
    if (report == null) {
      throw aiReportNotFound(reportId);
    }
    return report;
  }
}
