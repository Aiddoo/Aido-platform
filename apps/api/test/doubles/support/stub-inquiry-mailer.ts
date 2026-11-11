import {
  type InquiryDeliveryResult,
  InquiryMailerPort,
} from "#api/modules/support/inquiries/application/ports/inquiry-mailer.port";
import type { InquirySubmission } from "#api/modules/support/inquiries/application/read-models/inquiry-submission.read-model";

// 보낸 문의를 모으고 정해 둔 결과를 돌려준다
export class StubInquiryMailer extends InquiryMailerPort {
  readonly attempts: InquirySubmission[] = [];
  result: InquiryDeliveryResult = { status: "sent" };

  async deliver(submission: InquirySubmission): Promise<InquiryDeliveryResult> {
    this.attempts.push(submission);
    return this.result;
  }
}
