import {
  type UserReportDeliveryResult,
  UserReportNotifierPort,
} from "#api/modules/social/reports/application/ports/user-report-notifier.port";
import type { UserReportSubmission } from "#api/modules/social/reports/application/read-models/user-report-submission.read-model";

// 보낸 신고를 모으고, 정한 결과를 돌려주거나 Error를 받으면 던진다
export class RecordingUserReportNotifier extends UserReportNotifierPort {
  readonly submissions: UserReportSubmission[] = [];
  readonly #outcome: UserReportDeliveryResult | Error;

  constructor(outcome: UserReportDeliveryResult | Error = { status: "queued" }) {
    super();
    this.#outcome = outcome;
  }

  async notifyOperators(submission: UserReportSubmission): Promise<UserReportDeliveryResult> {
    this.submissions.push(submission);
    if (this.#outcome instanceof Error) {
      throw this.#outcome;
    }
    return this.#outcome;
  }
}
