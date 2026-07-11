import { ErrorCode } from "@aido/errors";
import type { InquiryCategory } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { now } from "@/shared/domain/date/utils/core";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { buildInquirySubmission } from "../../../domain/services/inquiry-submission";
import {
	INQUIRY_MAILER,
	type InquiryMailerPort,
} from "../../ports/inquiry-mailer.port";

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
@Injectable()
export class CreateInquiryUseCase {
	readonly #logger = new Logger(CreateInquiryUseCase.name);

	constructor(
		@Inject(INQUIRY_MAILER) private readonly mailer: InquiryMailerPort,
	) {}

	async execute(input: CreateInquiryInput): Promise<void> {
		const submission = buildInquirySubmission(
			{
				userEmail: input.userEmail,
				category: input.category,
				content: input.content,
			},
			now(),
		);

		const result = await this.mailer.deliver(submission);

		if (!result.success) {
			throw new ApplicationException(ErrorCode.INQUIRY_1501, {
				userId: input.userId,
				error: result.error,
			});
		}

		this.#logger.log(
			`Inquiry submitted: userId=${input.userId}, category=${input.category}`,
		);
	}
}
