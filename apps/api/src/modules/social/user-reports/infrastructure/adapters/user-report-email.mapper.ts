import type { UserReportReason, UserReportTargetType } from "@aido/api/vocabulary";

import type { UserReportSubmissionReadModel } from "../../application/read-models/user-report-submission.read-model.js";

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

export interface UserReportEmailContent {
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

// "2026-10-26 18:00 (KST)". 초 이하는 버린다
function formatSubmittedAt(instant: Temporal.Instant): string {
  const local = instant.toZonedDateTimeISO(OPERATOR_TIME_ZONE).toPlainDateTime();
  return `${local.toPlainDate().toString()} ${local.toPlainTime().toString({ smallestUnit: "minute" })} (KST)`;
}

export function toUserReportEmailContent(
  submission: UserReportSubmissionReadModel,
): UserReportEmailContent {
  return {
    ...submission,
    reporterTag: submission.reporterTag ?? MISSING_USER_TAG,
    targetUserTag: submission.targetUserTag ?? MISSING_USER_TAG,
    targetTypeLabel: TARGET_TYPE_LABELS[submission.targetType],
    reasonLabel: REASON_LABELS[submission.reason],
    submittedAt: formatSubmittedAt(submission.submittedAt),
  };
}
