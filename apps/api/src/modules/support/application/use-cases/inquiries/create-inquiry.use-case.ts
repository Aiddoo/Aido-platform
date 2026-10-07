import { ErrorCode } from "@aido/api/errors";
import type { InquiryCategory } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { buildInquirySubmission } from "../../../domain/services/inquiries/inquiry-submission.js";
import { type InquiryMailerPort } from "../../ports/inquiries/inquiry-mailer.port.js";

export interface CreateInquiryInput {
  userId: string;
  userEmail: string;
  category: InquiryCategory;
  content: string;
}

/**
 * 문의 접수 use-case
 *
 * 사용자 문의를 담당자에게 전달한다. 전달 실패 시 INQUIRY_1501을 던진다.
 */
interface CreateInquiryDependencies {
  readonly mailer: InquiryMailerPort;
  readonly logger: ApplicationLogger;
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

    if (!result.success) {
      throw new ApplicationException(ErrorCode.INQUIRY_1501, {
        userId: input.userId,
        error: result.error,
      });
    }

    this.#dependencies.logger.log(
      `Inquiry submitted: userId=${input.userId}, category=${input.category}`,
    );
  }
}
