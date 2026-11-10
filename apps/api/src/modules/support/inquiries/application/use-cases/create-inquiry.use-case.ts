import { ErrorCode } from "@aido/api/errors";
import type { InquiryCategory } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { now } from "#api/shared/domain/date/utils/core";

import { buildInquirySubmission } from "../messages/inquiry-submission.messages.js";
import { type InquiryMailerPort } from "../ports/inquiry-mailer.port.js";

export interface CreateInquiryInput {
  userId: string;
  userEmail: string;
  category: InquiryCategory;
  content: string;
}

/**
 * 문의 접수 use-case
 *
 * 사용자 문의를 담당자에게 전달한다. 문의는 DB에 남지 않으므로 전달 실패 시 INQUIRY_1501로 알려 다시 보내게 한다.
 */
interface CreateInquiryDependencies {
  readonly mailer: Pick<InquiryMailerPort, "deliver">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class CreateInquiry {
  readonly #dependencies: CreateInquiryDependencies;

  constructor(dependencies: CreateInquiryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateInquiryInput): Promise<void> {
    const submission = buildInquirySubmission(
      {
        userEmail: input.userEmail,
        category: input.category,
        content: input.content,
      },
      now(),
    );

    const result = await this.#dependencies.mailer.deliver(submission);

    if (result.status === "rejected") {
      throw new ApplicationException(ErrorCode.INQUIRY_1501, {
        userId: input.userId,
      });
    }

    this.#dependencies.logger.log({
      event: "support.inquiry.submitted",
      userId: input.userId,
      category: input.category,
    });
  }
}
