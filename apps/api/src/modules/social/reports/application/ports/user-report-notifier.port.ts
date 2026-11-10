import type { UserReportSubmission } from "../read-models/user-report-submission.read-model.js";

export const USER_REPORT_NOTIFIER = Symbol("USER_REPORT_NOTIFIER");

/** queued는 발송 큐에 담았다는 뜻이고 실제 발송은 비동기다. */
export type UserReportDeliveryResult =
  | { readonly status: "queued" }
  | { readonly status: "rejected"; readonly reason: string };

/** 접수한 신고를 운영자에게 알리는 벤더 중립 포트. 현재 어댑터는 고객센터 이메일이다. */
export interface UserReportNotifierPort {
  notifyOperators(submission: UserReportSubmission): Promise<UserReportDeliveryResult>;
}
