import type { UserReportNotifierPort } from "#api/modules/social/application/ports/reports/user-report-notifier.port";
import type {
  FindRecentUserReportParams,
  UserReportRepositoryPort,
} from "#api/modules/social/application/ports/reports/user-report.repository.port";
import type { UserReportSubmission } from "#api/modules/social/application/read-models/reports/user-report-submission.read-model";
import {
  UserReport,
  type UserReportCreationPlan,
} from "#api/modules/social/domain/aggregates/reports/user-report.aggregate";

export class StubUserReportRepository implements UserReportRepositoryPort {
  readonly userTags = new Map<string, string>();
  readonly reports: UserReport[] = [];

  addUser(userId: string, userTag: string): void {
    this.userTags.set(userId, userTag);
  }

  async userExists(userId: string): Promise<boolean> {
    return this.userTags.has(userId);
  }

  async findRecentByTarget(params: FindRecentUserReportParams): Promise<UserReport | null> {
    return (
      this.reports.findLast(
        (report) =>
          report.reporterId === params.reporterId &&
          report.targetUserId === params.targetUserId &&
          report.target.equals(params.target) &&
          report.createdAt >= params.since,
      ) ?? null
    );
  }

  async countByReporterSince(reporterId: string, since: Date): Promise<number> {
    return this.reports.filter(
      (report) => report.reporterId === reporterId && report.createdAt >= since,
    ).length;
  }

  async create(plan: UserReportCreationPlan): Promise<UserReport> {
    const report = UserReport.reconstitute({
      ...plan,
      id: `report-${this.reports.length + 1}`,
      status: "OPEN",
    });
    this.reports.push(report);
    return report;
  }

  async findUserTags(userIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    return new Map(
      userIds.flatMap((userId) => {
        const userTag = this.userTags.get(userId);
        return userTag == null ? [] : [[userId, userTag] as const];
      }),
    );
  }
}

export class StubUserReportNotifier implements UserReportNotifierPort {
  readonly submissions: UserReportSubmission[] = [];
  shouldFail = false;

  async notifyOperators(submission: UserReportSubmission) {
    this.submissions.push(submission);
    return this.shouldFail ? { success: false, error: "rejected" } : { success: true };
  }
}
