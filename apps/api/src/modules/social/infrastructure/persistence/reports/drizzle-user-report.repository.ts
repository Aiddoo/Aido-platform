import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, inArray } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user, userReport } from "#api/platform/database/schema/index";

import type {
  FindRecentUserReportParams,
  UserReportRepositoryPort,
} from "../../../application/ports/reports/user-report.repository.port.js";
import {
  UserReport,
  type UserReportCreationPlan,
} from "../../../domain/aggregates/reports/user-report.aggregate.js";
import { UserReportTarget } from "../../../domain/value-objects/reports/user-report-target.vo.js";

type UserReportRow = typeof userReport.$inferSelect;

@Injectable()
export class DrizzleUserReportRepository implements UserReportRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  private static toUserReport(row: UserReportRow): UserReport {
    return UserReport.reconstitute({
      id: row.id,
      reporterId: row.reporterId,
      targetUserId: row.targetUserId,
      target: UserReportTarget.of(row.targetType, row.targetId),
      reason: row.reason,
      detail: row.detail,
      status: row.status,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      resolvedById: row.resolvedById,
      resolutionNote: row.resolutionNote,
    });
  }

  async userExists(userId: string): Promise<boolean> {
    const found = await this.db.query.user.findFirst({
      columns: { id: true },
      where: { id: userId, status: "ACTIVE", deletedAt: { isNull: true } },
    });
    return found != null;
  }

  async findRecentByTarget(params: FindRecentUserReportParams): Promise<UserReport | null> {
    const { contentId } = params.target;
    const row = await this.db.query.userReport.findFirst({
      where: {
        reporterId: params.reporterId,
        targetUserId: params.targetUserId,
        targetType: params.target.type,
        targetId: contentId == null ? { isNull: true } : contentId,
        createdAt: { gte: params.since },
      },
      orderBy: { createdAt: "desc" },
    });
    return row == null ? null : DrizzleUserReportRepository.toUserReport(row);
  }

  countByReporterSince(reporterId: string, since: Date): Promise<number> {
    return this.db.$count(
      userReport,
      and(eq(userReport.reporterId, reporterId), gte(userReport.createdAt, since)),
    );
  }

  async create(plan: UserReportCreationPlan): Promise<UserReport> {
    const [row] = await this.db
      .insert(userReport)
      .values({
        reporterId: plan.reporterId,
        targetUserId: plan.targetUserId,
        targetType: plan.target.type,
        targetId: plan.target.contentId,
        reason: plan.reason,
        detail: plan.detail,
        createdAt: plan.createdAt,
      })
      .returning();
    return DrizzleUserReportRepository.toUserReport(requireRecord(row));
  }

  async findById(reportId: string): Promise<UserReport | null> {
    const row = await this.db.query.userReport.findFirst({ where: { id: reportId } });
    return row == null ? null : DrizzleUserReportRepository.toUserReport(row);
  }

  async saveResolution(report: UserReport): Promise<boolean> {
    const { resolvedAt, resolvedById, resolutionNote } = report;
    if (resolvedAt == null || resolvedById == null || resolutionNote == null) {
      return false;
    }
    const updated = await this.db
      .update(userReport)
      .set({ status: "RESOLVED", resolvedAt, resolvedById, resolutionNote })
      .where(and(eq(userReport.id, report.id), eq(userReport.status, "OPEN")))
      .returning({ id: userReport.id });
    return updated.length > 0;
  }

  async findUserTags(userIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db
      .select({ id: user.id, userTag: user.userTag })
      .from(user)
      .where(inArray(user.id, [...userIds]));
    return new Map(rows.map((row) => [row.id, row.userTag]));
  }
}
