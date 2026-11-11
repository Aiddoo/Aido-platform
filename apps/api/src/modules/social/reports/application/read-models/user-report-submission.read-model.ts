import type { UserReportReason, UserReportTargetType } from "@aido/api/vocabulary";

import type { UserReport } from "../../domain/user-report.aggregate.js";

// 운영자에게 전달하는 신고 한 건. 신고자 연락처·원문 콘텐츠는 담지 않고 id로 조회하게 한다
export interface UserReportSubmission {
  readonly reportId: string;
  readonly reporterId: string;
  readonly reporterTag: string;
  readonly targetUserId: string;
  readonly targetUserTag: string;
  readonly targetType: UserReportTargetType;
  readonly targetTypeLabel: string;
  readonly targetId: string | null;
  readonly reason: UserReportReason;
  readonly reasonLabel: string;
  readonly detail: string | null;
  readonly submittedAt: string;
}

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

// 운영자가 한국에 있어 접수 시각을 한국 시각으로 보여 준다
const OPERATOR_TIME_ZONE = "Asia/Seoul";
const MISSING_USER_TAG = "-";

// "2026-10-26 18:00 (KST)". 초 이하는 버린다
function formatSubmittedAt(instant: Temporal.Instant): string {
  const local = instant.toZonedDateTimeISO(OPERATOR_TIME_ZONE).toPlainDateTime();
  return `${local.toPlainDate().toString()} ${local.toPlainTime().toString({ smallestUnit: "minute" })} (KST)`;
}

export function toUserReportSubmission(
  report: UserReport,
  userTags: ReadonlyMap<string, string>,
): UserReportSubmission {
  const reporterId = report.reporterId.value;
  const targetUserId = report.targetUserId.value;
  return {
    reportId: report.id.value,
    reporterId,
    reporterTag: userTags.get(reporterId) ?? MISSING_USER_TAG,
    targetUserId,
    targetUserTag: userTags.get(targetUserId) ?? MISSING_USER_TAG,
    targetType: report.target.type,
    targetTypeLabel: TARGET_TYPE_LABELS[report.target.type],
    targetId: report.target.contentId,
    reason: report.reason,
    reasonLabel: REASON_LABELS[report.reason],
    detail: report.detail.value,
    submittedAt: formatSubmittedAt(report.createdAt),
  };
}
