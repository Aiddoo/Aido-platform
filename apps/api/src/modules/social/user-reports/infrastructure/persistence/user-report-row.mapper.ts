import type { userReport as userReportTable } from "#api/platform/database/schema/social.schema";

import { UserReport } from "../../domain/user-report.aggregate.js";

type UserReportRow = typeof userReportTable.$inferSelect;
type UserReportInsertRow = typeof userReportTable.$inferInsert;

export function toUserReport(row: UserReportRow): UserReport {
  return UserReport.reconstitute(row);
}

export function toUserReportRow(report: UserReport): UserReportInsertRow {
  return report.toPrimitives();
}
