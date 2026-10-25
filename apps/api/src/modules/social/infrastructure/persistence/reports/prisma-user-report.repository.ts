import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import { type UserReport as UserReportRow } from "#api/platform/database/database.types";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  FindRecentUserReportParams,
  UserReportRepositoryPort,
} from "../../../application/ports/reports/user-report.repository.port.js";
import {
  UserReport,
  type UserReportCreationPlan,
} from "../../../domain/aggregates/reports/user-report.aggregate.js";
import { UserReportTarget } from "../../../domain/value-objects/reports/user-report-target.vo.js";

@Injectable()
export class PrismaUserReportRepository implements UserReportRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
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
    const user = await this.client.orm.public.User.where((row) =>
      and(row.id.eq(userId), row.status.eq("ACTIVE"), row.deletedAt.isNull()),
    )
      .select("id")
      .first();
    return user != null;
  }

  async findRecentByTarget(params: FindRecentUserReportParams): Promise<UserReport | null> {
    const { contentId } = params.target;
    const row = decodeRecord(
      "UserReport",
      await this.client.orm.public.UserReport.where((row) =>
        and(
          row.reporterId.eq(params.reporterId),
          row.targetUserId.eq(params.targetUserId),
          row.targetType.eq(params.target.type),
          contentId == null ? row.targetId.isNull() : row.targetId.eq(varchar(contentId, 64)),
          row.createdAt.gte(databaseTimestamp(params.since)),
        ),
      )
        .orderBy((row) => row.createdAt.desc())
        .first(),
    );
    return row == null ? null : PrismaUserReportRepository.toUserReport(row);
  }

  countByReporterSince(reporterId: string, since: Date): Promise<number> {
    return this.client.orm.public.UserReport.where((row) =>
      and(row.reporterId.eq(reporterId), row.createdAt.gte(databaseTimestamp(since))),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async create(plan: UserReportCreationPlan): Promise<UserReport> {
    const row = decodeRecord(
      "UserReport",
      await this.client.orm.public.UserReport.create(
        encodeCreate("UserReport", {
          reporterId: plan.reporterId,
          targetUserId: plan.targetUserId,
          targetType: plan.target.type,
          targetId: plan.target.contentId,
          reason: plan.reason,
          detail: plan.detail,
          createdAt: plan.createdAt,
        }),
      ),
    );
    return PrismaUserReportRepository.toUserReport(row);
  }

  async findById(reportId: string): Promise<UserReport | null> {
    const row = decodeRecord(
      "UserReport",
      await this.client.orm.public.UserReport.where((row) => row.id.eq(reportId)).first(),
    );
    return row == null ? null : PrismaUserReportRepository.toUserReport(row);
  }

  async saveResolution(report: UserReport): Promise<boolean> {
    const { resolvedAt, resolvedById, resolutionNote } = report;
    if (resolvedAt == null || resolvedById == null || resolutionNote == null) {
      return false;
    }
    const updated = await this.client.orm.public.UserReport.where((row) =>
      and(row.id.eq(report.id), row.status.eq("OPEN")),
    ).updateAndCount(
      encodePatch("UserReport", {
        status: "RESOLVED",
        resolvedAt,
        resolvedById,
        resolutionNote,
      }),
    );
    return updated > 0;
  }

  async findUserTags(userIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const rows = await this.client.orm.public.User.where((row) => row.id.in([...userIds]))
      .select("id", "userTag")
      .all();
    return new Map(rows.map((row) => [row.id, row.userTag]));
  }
}
