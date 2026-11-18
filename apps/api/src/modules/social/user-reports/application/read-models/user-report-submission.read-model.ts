import type { UserReportReason, UserReportTargetType } from "@aido/api/vocabulary";

// 운영자에게 전달하는 신고 한 건. 신고자 연락처·원문 콘텐츠는 담지 않고 id로 조회하게 한다.
// 태그를 찾지 못한 사용자는 null이다
export interface UserReportSubmissionReadModel {
  readonly reportId: string;
  readonly reporterId: string;
  readonly reporterTag: string | null;
  readonly targetUserId: string;
  readonly targetUserTag: string | null;
  readonly targetType: UserReportTargetType;
  readonly targetId: string | null;
  readonly reason: UserReportReason;
  readonly detail: string | null;
  readonly submittedAt: Temporal.Instant;
}
