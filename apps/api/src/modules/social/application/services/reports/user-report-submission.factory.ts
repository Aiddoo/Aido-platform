import type { UserReportReason, UserReportTargetType } from "@aido/api/vocabulary";

import type { UserReport } from "../../../domain/aggregates/reports/user-report.aggregate.js";
import type { UserReportSubmission } from "../../read-models/reports/user-report-submission.read-model.js";

const REASON_LABELS = {
  SPAM: "스팸·광고",
  HARASSMENT: "괴롭힘·혐오",
  INAPPROPRIATE: "부적절한 내용",
  IMPERSONATION: "사칭",
  OTHER: "기타",
} as const satisfies Record<UserReportReason, string>;

const TARGET_TYPE_LABELS = {
  PROFILE: "프로필·닉네임",
  TODO: "할 일",
  COMMENT: "댓글",
  NUDGE_MESSAGE: "콕 찌르기 메시지",
  CHEER_MESSAGE: "응원 메시지",
} as const satisfies Record<UserReportTargetType, string>;

const KST_DATE_TIME_FORMAT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function buildUserReportSubmission(
  report: UserReport,
  userTags: ReadonlyMap<string, string>,
): UserReportSubmission {
  return {
    reportId: report.id,
    reporterId: report.reporterId,
    reporterTag: userTags.get(report.reporterId) ?? "-",
    targetUserId: report.targetUserId,
    targetUserTag: userTags.get(report.targetUserId) ?? "-",
    targetType: report.target.type,
    targetTypeLabel: TARGET_TYPE_LABELS[report.target.type],
    targetId: report.target.contentId,
    reason: report.reason,
    reasonLabel: REASON_LABELS[report.reason],
    detail: report.detail,
    submittedAt: `${KST_DATE_TIME_FORMAT.format(report.createdAt)} (KST)`,
  };
}
