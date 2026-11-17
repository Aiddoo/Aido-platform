import type {
  CreateUserReportResponse,
  ResolveUserReportResponse,
} from "@aido/api/contracts/user-report";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { UserReport } from "../../../domain/user-report.aggregate.js";

const USER_REPORT_RESPONSE_MESSAGES = {
  CREATED: "신고를 접수했습니다.",
  RESOLVED: "신고를 처리 완료로 바꿨습니다.",
} as const;

export function toCreateUserReportResponse(report: UserReport): CreateUserReportResponse {
  return {
    message: USER_REPORT_RESPONSE_MESSAGES.CREATED,
    report: {
      id: report.id.value,
      status: report.status,
      createdAt: toIsoString(report.createdAt),
    },
  };
}

export function toResolveUserReportResponse(report: UserReport): ResolveUserReportResponse {
  const { resolvedAt, resolutionNote } = report;
  return {
    message: USER_REPORT_RESPONSE_MESSAGES.RESOLVED,
    report: {
      id: report.id.value,
      status: report.status,
      createdAt: toIsoString(report.createdAt),
      resolvedAt: resolvedAt == null ? null : toIsoString(resolvedAt),
      resolutionNote: resolutionNote?.value ?? null,
    },
  };
}
