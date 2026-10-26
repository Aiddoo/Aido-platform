import type { UserReportReason, UserReportTargetType } from "@aido/api/vocabulary";

/** 운영자에게 전달하는 신고 한 건. 신고자 연락처·원문 콘텐츠는 담지 않고 ID로 조회하게 한다. */
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
