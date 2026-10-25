import { ErrorCode } from "@aido/api/errors";

import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { UserReport } from "../../../domain/aggregates/reports/user-report.aggregate.js";
import { type UserReportRepositoryPort } from "../../ports/reports/user-report.repository.port.js";

export interface ResolveUserReportInput {
  readonly reportId: string;
  readonly adminId: string;
  readonly note: string;
}

interface ResolveUserReportDependencies {
  readonly userReportRepository: Pick<UserReportRepositoryPort, "findById" | "saveResolution">;
  readonly unitOfWork: UnitOfWorkPort;
}

/**
 * 운영자가 신고를 확인하고 한 조치를 남겨 처리 완료로 바꾼다.
 * 이미 처리한 신고는 첫 처리 기록을 그대로 돌려줘, 두 운영자가 동시에 처리해도 기록이 덮이지 않는다.
 */
export class ResolveUserReport {
  readonly #dependencies: ResolveUserReportDependencies;

  constructor(dependencies: ResolveUserReportDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: ResolveUserReportInput): Promise<UserReport> {
    return this.#dependencies.unitOfWork.run(async () => {
      const report = await this.#findReport(input.reportId);
      const isNewlyResolved = report.resolve({
        resolvedById: input.adminId,
        note: input.note,
        resolvedAt: now(),
      });
      if (
        !isNewlyResolved ||
        (await this.#dependencies.userReportRepository.saveResolution(report))
      ) {
        return report;
      }
      // 읽은 뒤 다른 운영자가 먼저 처리했다. 저장된 첫 처리 기록을 돌려준다
      return this.#findReport(input.reportId);
    });
  }

  async #findReport(reportId: string): Promise<UserReport> {
    const report = await this.#dependencies.userReportRepository.findById(reportId);
    if (report == null) {
      throw new ApplicationException(ErrorCode.REPORT_2255, { reportId });
    }
    return report;
  }
}
