import { Inject, Injectable } from "@nestjs/common";

import { SendTransactionalEmailUseCase } from "#api/modules/notification/notification-email.public";

import {
  type InquiryDeliveryResult,
  InquiryMailerPort,
} from "../../application/ports/inquiry-mailer.port.js";
import type { InquirySubmissionReadModel } from "../../application/read-models/inquiry-submission.read-model.js";
import {
  type SupportInquiriesConfig,
  supportInquiriesConfig,
} from "../../support-inquiries.config.js";

@Injectable()
export class EmailInquiryMailerAdapter extends InquiryMailerPort {
  readonly #emailSender: Pick<SendTransactionalEmailUseCase, "sendInquiry">;
  readonly #supportEmail: string;

  constructor(
    emailSender: SendTransactionalEmailUseCase,
    @Inject(supportInquiriesConfig.KEY) config: SupportInquiriesConfig,
  ) {
    super();
    this.#emailSender = emailSender;
    this.#supportEmail = config.supportEmail;
  }

  deliver(submission: InquirySubmissionReadModel): Promise<InquiryDeliveryResult> {
    return this.#emailSender.sendInquiry(this.#supportEmail, {
      userEmail: submission.userEmail,
      category: submission.category,
      categoryLabel: submission.categoryLabel,
      content: submission.content,
      submittedAt: submission.submittedAt,
    });
  }
}
