import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, inArray } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import { user, userReport } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserReportRepositoryPort } from "../../application/ports/user-report.repository.port.js";
import { UserReportId } from "../../domain/user-report-id.vo.js";
import type { UserReportTarget } from "../../domain/user-report-target.vo.js";
import type { UserReport } from "../../domain/user-report.aggregate.js";
import { toUserReport, toUserReportRow } from "./user-report-row.mapper.js";

@Injectable()
export class DrizzleUserReportRepository implements UserReportRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<UserReportId> {
    return UserReportId.reconstitute(createEntityId());
  }

  async existsActiveUser(userId: UserId): Promise<boolean> {
    const found = await this.#db.query.user.findFirst({
      columns: { id: true },
      where: { id: userId.value, status: "ACTIVE", deletedAt: { isNull: true } },
    });
    return found != null;
  }

  async findRecentByTarget(params: {
    readonly reporterId: UserId;
    readonly targetUserId: UserId;
    readonly target: UserReportTarget;
    readonly since: Temporal.Instant;
  }): Promise<UserReport | null> {
    const { contentId } = params.target;
    const row = await this.#db.query.userReport.findFirst({
      where: {
        reporterId: params.reporterId.value,
        targetUserId: params.targetUserId.value,
        targetType: params.target.type,
        targetId: contentId == null ? { isNull: true } : contentId,
        createdAt: { gte: params.since },
      },
      orderBy: { createdAt: "desc" },
    });
    return row == null ? null : toUserReport(row);
  }

  countByReporterSince(reporterId: UserId, since: Temporal.Instant): Promise<number> {
    return this.#db.$count(
      userReport,
      and(eq(userReport.reporterId, reporterId.value), gte(userReport.createdAt, since)),
    );
  }

  async findById(reportId: UserReportId): Promise<UserReport | null> {
    const row = await this.#db.query.userReport.findFirst({ where: { id: reportId.value } });
    return row == null ? null : toUserReport(row);
  }

  async findUserTags(userIds: readonly UserId[]): Promise<ReadonlyMap<string, string>> {
    const rows = await this.#db
      .select({ id: user.id, userTag: user.userTag })
      .from(user)
      .where(
        inArray(
          user.id,
          userIds.map((userId) => userId.value),
        ),
      );
    return new Map(rows.map((row) => [row.id, row.userTag]));
  }

  async save(report: UserReport): Promise<void> {
    const row = toUserReportRow(report);
    await this.#db
      .insert(userReport)
      .values(row)
      .onConflictDoUpdate({
        target: userReport.id,
        set: {
          status: row.status,
          resolvedAt: row.resolvedAt,
          resolvedById: row.resolvedById,
          resolutionNote: row.resolutionNote,
        },
      });
  }

  async saveResolution(report: UserReport): Promise<boolean> {
    const row = toUserReportRow(report);
    if (row.status !== "RESOLVED") {
      return false;
    }
    const updated = await this.#db
      .update(userReport)
      .set({
        status: row.status,
        resolvedAt: row.resolvedAt,
        resolvedById: row.resolvedById,
        resolutionNote: row.resolutionNote,
      })
      .where(and(eq(userReport.id, report.id.value), eq(userReport.status, "OPEN")))
      .returning({ id: userReport.id });
    return updated.length > 0;
  }
}
