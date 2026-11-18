import { Inject, Injectable } from "@nestjs/common";

import { SendInquiryEmailUseCase } from "#api/modules/notification/email-messages/notification-email-messages.public";

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
  readonly #sendInquiryEmail: Pick<SendInquiryEmailUseCase, "execute">;
  readonly #supportEmail: string;

  constructor(
    sendInquiryEmail: SendInquiryEmailUseCase,
    @Inject(supportInquiriesConfig.KEY) config: SupportInquiriesConfig,
  ) {
    super();
    this.#sendInquiryEmail = sendInquiryEmail;
    this.#supportEmail = config.supportEmail;
  }

  deliver(submission: InquirySubmissionReadModel): Promise<InquiryDeliveryResult> {
    return this.#sendInquiryEmail.execute({
      to: this.#supportEmail,
      templateData: {
        userEmail: submission.userEmail,
        category: submission.category,
        categoryLabel: submission.categoryLabel,
        content: submission.content,
        submittedAt: submission.submittedAt,
      },
    });
  }
}
