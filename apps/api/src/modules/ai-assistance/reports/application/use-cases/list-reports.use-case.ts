import {
  assertEntitled,
  type EntitlementReaderPort,
} from "#api/modules/access/entitlements/access-entitlements.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AiReport } from "../../domain/ai-report.aggregate.js";
import type { ReportType } from "../../domain/ai-report.constants.js";
import type { AiReportRepositoryPort } from "../ports/ai-report.repository.port.js";

export interface ListReportsQuery {
  readonly userId: string;
  readonly type?: ReportType;
  readonly limit: number;
}

interface ListReportsDependencies {
  readonly aiReportRepository: Pick<AiReportRepositoryPort, "listByUserId">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
}

export class ListReportsUseCase {
  readonly #dependencies: ListReportsDependencies;

  constructor(dependencies: ListReportsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ListReportsQuery): Promise<AiReport[]> {
    await assertEntitled(
      this.#dependencies.entitlementReader,
      UserId.reconstitute(query.userId),
      "AI_REPORT",
    );

    return this.#dependencies.aiReportRepository.listByUserId({
      userId: UserId.reconstitute(query.userId),
      type: query.type ?? null,
      limit: query.limit,
    });
  }
}
