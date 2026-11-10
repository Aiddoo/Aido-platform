import type { UserReportSubmission } from "../read-models/user-report-submission.read-model.js";

// queued는 발송 큐에 담았다는 뜻이고 실제 발송은 비동기다
export type UserReportDeliveryResult =
  | { readonly status: "queued" }
  | { readonly status: "rejected"; readonly reason: string };

export abstract class UserReportNotifierPort {
  abstract notifyOperators(submission: UserReportSubmission): Promise<UserReportDeliveryResult>;
}
