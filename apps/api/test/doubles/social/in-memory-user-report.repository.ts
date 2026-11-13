import { UserReportRepositoryPort } from "#api/modules/social/reports/application/ports/user-report.repository.port";
import type { UserReportId } from "#api/modules/social/reports/domain/user-report-id.vo";
import type { UserReportTarget } from "#api/modules/social/reports/domain/user-report-target.vo";
import {
  UserReport,
  type UserReportVersion,
} from "#api/modules/social/reports/domain/user-report.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(report: UserReport): UserReport {
  return UserReport.reconstitute(report.toPrimitives());
}

// Drizzle 저장소처럼 다시 저장할 때 처리 상태·기록만 바꾼다
function withResolutionOf(stored: UserReport, report: UserReport): UserReport {
  const { status, resolvedAt, resolvedById, resolutionNote } = report.toPrimitives();
  return UserReport.reconstitute({
    ...stored.toPrimitives(),
    status,
    resolvedAt,
    resolvedById,
    resolutionNote,
  });
}

export class InMemoryUserReportRepository extends UserReportRepositoryPort {
  readonly #reports = new Map<string, UserReport>();
  // 활성 사용자 id → 사용자 태그
  readonly #activeUserTags: ReadonlyMap<string, string>;

  constructor(
    params: {
      readonly reports?: readonly UserReport[];
      readonly activeUserTags?: Readonly<Record<string, string>>;
    } = {},
  ) {
    super();
    for (const report of params.reports ?? []) {
      this.#reports.set(report.id.value, copyOf(report));
    }
    this.#activeUserTags = new Map(Object.entries(params.activeUserTags ?? {}));
  }

  get size(): number {
    return this.#reports.size;
  }

  async existsActiveUser(userId: UserId): Promise<boolean> {
    return this.#activeUserTags.has(userId.value);
  }

  async findRecentByTarget(params: {
    readonly reporterId: UserId;
    readonly targetUserId: UserId;
    readonly target: UserReportTarget;
    readonly since: Temporal.Instant;
  }): Promise<UserReport | null> {
    const matches = [...this.#reports.values()].filter(
      (report) =>
        report.reporterId.equals(params.reporterId) &&
        report.targetUserId.equals(params.targetUserId) &&
        report.target.equals(params.target) &&
        Temporal.Instant.compare(report.createdAt, params.since) >= 0,
    );
    const latest = matches
      .toSorted((left, right) => Temporal.Instant.compare(right.createdAt, left.createdAt))
      .at(0);
    return latest == null ? null : copyOf(latest);
  }

  async countByReporterSince(reporterId: UserId, since: Temporal.Instant): Promise<number> {
    return [...this.#reports.values()].filter(
      (report) =>
        report.reporterId.equals(reporterId) &&
        Temporal.Instant.compare(report.createdAt, since) >= 0,
    ).length;
  }

  async findById(reportId: UserReportId): Promise<UserReport | null> {
    const report = this.#reports.get(reportId.value);
    return report == null ? null : copyOf(report);
  }

  async findUserTags(userIds: readonly UserId[]): Promise<ReadonlyMap<string, string>> {
    return new Map(
      userIds.flatMap((userId) => {
        const userTag = this.#activeUserTags.get(userId.value);
        return userTag == null ? [] : [[userId.value, userTag] as const];
      }),
    );
  }

  async save(report: UserReport): Promise<void> {
    const stored = this.#reports.get(report.id.value);
    this.#reports.set(
      report.id.value,
      stored == null ? copyOf(report) : withResolutionOf(stored, report),
    );
  }

  async saveIfUnchanged(report: UserReport, expected: UserReportVersion): Promise<boolean> {
    const stored = this.#reports.get(report.id.value);
    if (stored == null || stored.status !== expected.status) {
      return false;
    }
    this.#reports.set(report.id.value, withResolutionOf(stored, report));
    return true;
  }
}
