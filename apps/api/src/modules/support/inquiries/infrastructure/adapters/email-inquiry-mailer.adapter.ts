import { Injectable } from "@nestjs/common";

import { TransactionalEmailSender } from "#api/modules/notification/notification-email.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";

import {
  type InquiryDeliveryResult,
  InquiryMailerPort,
} from "../../application/ports/inquiry-mailer.port.js";
import type { InquirySubmission } from "../../application/read-models/inquiry-submission.read-model.js";

// 수신 주소(supportEmail)는 설정에서 읽어 Application으로 새지 않게 한다

@Injectable()
export class EmailInquiryMailerAdapter extends InquiryMailerPort {
  readonly #emailSender: TransactionalEmailSender;
  readonly #configService: TypedConfigService;

  constructor(emailSender: TransactionalEmailSender, configService: TypedConfigService) {
    super();
    this.#emailSender = emailSender;
    this.#configService = configService;
  }

  deliver(submission: InquirySubmission): Promise<InquiryDeliveryResult> {
    const supportEmail = this.#configService.email.supportEmail;

    return this.#emailSender.sendInquiry(supportEmail, {
      userEmail: submission.userEmail,
      category: submission.category,
      categoryLabel: submission.categoryLabel,
      content: submission.content,
      submittedAt: submission.submittedAt,
    });
  }
}
