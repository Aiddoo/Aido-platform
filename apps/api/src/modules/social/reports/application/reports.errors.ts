import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserReportId } from "../domain/user-report-id.vo.js";

export function reportTargetUserNotFound(targetUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.REPORT_2252, { targetUserId: targetUserId.value });
}

export function dailyReportLimitReached(currentCount: number): ApplicationException {
  return new ApplicationException(ErrorCode.REPORT_2254, { current: currentCount });
}

export function userReportNotFound(reportId: UserReportId): ApplicationException {
  return new ApplicationException(ErrorCode.REPORT_2255, { reportId: reportId.value });
}
