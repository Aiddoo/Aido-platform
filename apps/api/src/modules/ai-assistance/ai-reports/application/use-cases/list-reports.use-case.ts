import {
  assertEntitled,
  type EntitlementReaderPort,
} from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/timezone-name";

import type { UserLocalePreferenceReaderPort } from "../../../ai-generations/application/ports/user-locale-preference.reader.port.js";
import type { ReportType } from "../../domain/ai-reports.constants.js";
import type { AiReportRepositoryPort } from "../ports/ai-report.repository.port.js";
import type { ReportListReadModel } from "../read-models/report-list.read-model.js";

export interface ListReportsQuery {
  readonly userId: string;
  readonly type?: ReportType;
  readonly limit: number;
}

interface ListReportsDependencies {
  readonly aiReportRepository: Pick<AiReportRepositoryPort, "listByUserId">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly clock: ClockPort;
}

export class ListReportsUseCase {
  readonly #dependencies: ListReportsDependencies;

  constructor(dependencies: ListReportsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ListReportsQuery): Promise<ReportListReadModel> {
    const owner = UserId.reconstitute(query.userId);
    await assertEntitled(this.#dependencies.entitlementReader, owner, "AI_REPORT");

    const [reports, { timezone }] = await Promise.all([
      this.#dependencies.aiReportRepository.listByUserId({
        userId: owner,
        type: query.type ?? null,
        limit: query.limit,
      }),
      this.#dependencies.localePreferenceReader.read(owner),
    ]);
    return { reports, localToday: localDateIn(this.#dependencies.clock.now(), timezone) };
  }
}
