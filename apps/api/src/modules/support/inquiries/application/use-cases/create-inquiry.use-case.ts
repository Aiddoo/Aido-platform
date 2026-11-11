import type { InquiryCategory } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { InquiryContent } from "../../domain/inquiry-content.vo.js";
import { InquiryId } from "../../domain/inquiry-id.vo.js";
import { Inquiry } from "../../domain/inquiry.entity.js";
import { inquiryDeliveryFailed } from "../inquiries.errors.js";
import { InquiryLogEvent } from "../inquiries.log-events.js";
import { toInquirySubmission } from "../messages/inquiry-submission.messages.js";
import type { InquiryMailerPort } from "../ports/inquiry-mailer.port.js";

export interface CreateInquiryCommand {
  readonly userId: string;
  readonly userEmail: string;
  readonly category: InquiryCategory;
  readonly content: string;
}

export interface CreateInquiryDependencies {
  readonly clock: ClockPort;
  readonly mailer: Pick<InquiryMailerPort, "deliver">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

// 문의는 DB에 남지 않으므로 전달에 실패하면 INQUIRY_1501로 알려 사용자가 다시 보내게 한다
export class CreateInquiryUseCase {
  readonly #dependencies: CreateInquiryDependencies;

  constructor(dependencies: CreateInquiryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: CreateInquiryCommand): Promise<Inquiry> {
    const { clock, mailer, logger } = this.#dependencies;
    const inquiry = Inquiry.create({
      id: InquiryId.generate(),
      userId: UserId.reconstitute(command.userId),
      userEmail: command.userEmail,
      category: command.category,
      content: InquiryContent.create(command.content),
      now: clock.now(),
    });

    const result = await mailer.deliver(toInquirySubmission(inquiry));
    if (result.status === "rejected") {
      throw inquiryDeliveryFailed(inquiry.userId);
    }

    logger.log({
      event: InquiryLogEvent.SUBMITTED,
      userId: inquiry.userId.value,
      category: inquiry.category,
    });
    return inquiry;
  }
}
