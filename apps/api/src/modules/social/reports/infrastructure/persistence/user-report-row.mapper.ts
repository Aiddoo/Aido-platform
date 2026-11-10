import type { userReport as userReportTable } from "#api/platform/database/schema/social.schema";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import { UserReport } from "../../domain/user-report.aggregate.js";

type UserReportRow = typeof userReportTable.$inferSelect;
type UserReportInsertRow = typeof userReportTable.$inferInsert;

export function toUserReport(row: UserReportRow): UserReport {
  return UserReport.reconstitute({
    ...row,
    createdAt: instantFromDate(row.createdAt),
    resolvedAt: row.resolvedAt == null ? null : instantFromDate(row.resolvedAt),
  });
}

export function toUserReportRow(report: UserReport): UserReportInsertRow {
  const { createdAt, resolvedAt, ...primitives } = report.toPrimitives();
  return {
    ...primitives,
    createdAt: instantToDate(createdAt),
    resolvedAt: resolvedAt == null ? null : instantToDate(resolvedAt),
  };
}
