import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserReportId } from "../../domain/user-report-id.vo.js";
import type { UserReportTarget } from "../../domain/user-report-target.vo.js";
import type { UserReport, UserReportVersion } from "../../domain/user-report.aggregate.js";

export abstract class UserReportRepositoryPort {
  // 같은 신고자가 since 이후(since 포함) 같은 대상에 남긴 가장 최근 신고
  abstract findRecentByTarget(params: {
    readonly reporterId: UserId;
    readonly targetUserId: UserId;
    readonly target: UserReportTarget;
    readonly since: Temporal.Instant;
  }): Promise<UserReport | null>;
  abstract countByReporterSince(reporterId: UserId, since: Temporal.Instant): Promise<number>;
  abstract findById(reportId: UserReportId): Promise<UserReport | null>;
  abstract save(report: UserReport): Promise<void>;
  // 저장된 신고가 expected 상태일 때만 저장하고 true다. 그사이 다른 운영자가 처리했으면 false다
  abstract saveIfUnchanged(report: UserReport, expected: UserReportVersion): Promise<boolean>;
}
