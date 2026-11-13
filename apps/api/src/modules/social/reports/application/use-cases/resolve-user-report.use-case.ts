import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserReportId } from "../../domain/user-report-id.vo.js";
import { UserReportResolutionNote } from "../../domain/user-report-resolution-note.vo.js";
import type { UserReport } from "../../domain/user-report.aggregate.js";
import type { UserReportRepositoryPort } from "../ports/user-report.repository.port.js";
import { userReportNotFound } from "../reports.errors.js";

export interface ResolveUserReportCommand {
  readonly reportId: string;
  readonly adminId: string;
  readonly note: string;
}

export interface ResolveUserReportDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly userReportRepository: Pick<UserReportRepositoryPort, "findById" | "saveIfUnchanged">;
  readonly clock: ClockPort;
}

// 이미 처리한 신고는 첫 처리 기록을 그대로 돌려줘, 두 운영자가 동시에 처리해도 기록이 덮이지 않는다
export class ResolveUserReportUseCase {
  readonly #dependencies: ResolveUserReportDependencies;

  constructor(dependencies: ResolveUserReportDependencies) {
    this.#dependencies = dependencies;
  }

  execute(command: ResolveUserReportCommand): Promise<UserReport> {
    const { unitOfWork, userReportRepository, clock } = this.#dependencies;
    const reportId = UserReportId.reconstitute(command.reportId);

    return unitOfWork.run(async () => {
      const report = await this.#findReport(reportId);
      const expected = report.version;
      const note = UserReportResolutionNote.create(command.note);
      const isResolved = report.resolve({
        resolvedById: UserId.reconstitute(command.adminId),
        note,
        now: clock.now(),
      });
      if (!isResolved || (await userReportRepository.saveIfUnchanged(report, expected))) {
        return report;
      }
      // 읽은 뒤 다른 운영자가 먼저 처리했다. 저장된 첫 처리 기록을 돌려준다
      return this.#findReport(reportId);
    });
  }

  async #findReport(reportId: UserReportId): Promise<UserReport> {
    const report = await this.#dependencies.userReportRepository.findById(reportId);
    if (report == null) {
      throw userReportNotFound(reportId);
    }
    return report;
  }
}
