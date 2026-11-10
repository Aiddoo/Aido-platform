import type { InquiryCategory } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { now } from "#api/shared/domain/date/utils/core";

import { inquiryDeliveryFailed } from "../inquiries.errors.js";
import { InquiryLogEvent } from "../inquiries.log-events.js";
import { buildInquirySubmission } from "../messages/inquiry-submission.messages.js";
import type { InquiryMailerPort } from "../ports/inquiry-mailer.port.js";

export interface CreateInquiryCommand {
  readonly userId: string;
  readonly userEmail: string;
  readonly category: InquiryCategory;
  readonly content: string;
}

export interface CreateInquiryDependencies {
  readonly mailer: Pick<InquiryMailerPort, "deliver">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 문의는 DB에 남지 않으므로 전달에 실패하면 INQUIRY_1501로 알려 다시 보내게 한다. */
export class CreateInquiryUseCase {
  readonly #dependencies: CreateInquiryDependencies;

  constructor(dependencies: CreateInquiryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: CreateInquiryCommand): Promise<void> {
    const { mailer, logger } = this.#dependencies;
    const submission = buildInquirySubmission(command, now());

    const result = await mailer.deliver(submission);

    if (result.status === "rejected") {
      throw inquiryDeliveryFailed(command.userId);
    }

    logger.log({
      event: InquiryLogEvent.SUBMITTED,
      userId: command.userId,
      category: command.category,
    });
  }
}
