import type {
  UserReport,
  UserReportCreationPlan,
} from "../../../domain/aggregates/reports/user-report.aggregate.js";
import type { UserReportTarget } from "../../../domain/value-objects/reports/user-report-target.vo.js";

export const USER_REPORT_REPOSITORY = Symbol("USER_REPORT_REPOSITORY");

export interface FindRecentUserReportParams {
  reporterId: string;
  targetUserId: string;
  target: UserReportTarget;
  since: Date;
}

export interface UserReportRepositoryPort {
  /** 활성 사용자만 신고 대상으로 본다(탈퇴·비활성 제외). */
  userExists(userId: string): Promise<boolean>;
  /** 같은 신고자가 since 이후 같은 대상에 남긴 가장 최근 신고 */
  findRecentByTarget(params: FindRecentUserReportParams): Promise<UserReport | null>;
  countByReporterSince(reporterId: string, since: Date): Promise<number>;
  create(plan: UserReportCreationPlan): Promise<UserReport>;
  /** 운영자 알림에 쓰는 사용자 태그. 찾지 못한 ID는 결과에 없다. */
  findUserTags(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
