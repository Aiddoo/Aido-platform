import {
  assertEntitled,
  type EntitlementReaderPort,
} from "#api/modules/access/entitlements/access-entitlements.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserLocalePreferenceReaderPort } from "../../../generation/application/ports/user-locale-preference.reader.port.js";
import { localDateAt } from "../../../shared/domain/user-calendar.domain-service.js";
import { AiReportId } from "../../domain/ai-report-id.vo.js";
import type { AiReportRepositoryPort } from "../ports/ai-report.repository.port.js";
import type { ReportDetailReadModel } from "../read-models/report-detail.read-model.js";
import { aiReportNotFound } from "../reports.errors.js";

export interface GetReportByIdQuery {
  readonly userId: string;
  readonly reportId: number;
}

interface GetReportByIdDependencies {
  readonly aiReportRepository: Pick<AiReportRepositoryPort, "findByIdAndUserId">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly clock: ClockPort;
}

export class GetReportByIdUseCase {
  readonly #dependencies: GetReportByIdDependencies;

  constructor(dependencies: GetReportByIdDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetReportByIdQuery): Promise<ReportDetailReadModel> {
    const owner = UserId.reconstitute(query.userId);
    await assertEntitled(this.#dependencies.entitlementReader, owner, "AI_REPORT");

    const reportId = AiReportId.reconstitute(query.reportId);
    const report = await this.#dependencies.aiReportRepository.findByIdAndUserId(reportId, owner);
    if (report == null) {
      throw aiReportNotFound(reportId);
    }
    const { timezone } = await this.#dependencies.localePreferenceReader.read(owner);
    return { report, localToday: localDateAt(this.#dependencies.clock.now(), timezone) };
  }
}
