import { ErrorCode } from "@aido/errors";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { now } from "@/shared/domain/date/utils/core";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { buildInquirySubmission } from "../../../domain/services/inquiry-submission";
import {
	INQUIRY_MAILER,
	type InquiryMailerPort,
} from "../../ports/inquiry-mailer.port";
import { CreateInquiryCommand } from "./create-inquiry.command";

@CommandHandler(CreateInquiryCommand)
export class CreateInquiryHandler
	implements ICommandHandler<CreateInquiryCommand, void>
{
	readonly #logger = new Logger(CreateInquiryHandler.name);

	constructor(
		@Inject(INQUIRY_MAILER) private readonly mailer: InquiryMailerPort,
	) {}

	async execute(command: CreateInquiryCommand): Promise<void> {
		const submission = buildInquirySubmission(
			{
				userEmail: command.userEmail,
				category: command.category,
				content: command.content,
			},
			now(),
		);

		const result = await this.mailer.deliver(submission);

		if (!result.success) {
			throw new ApplicationException(ErrorCode.INQUIRY_1501, {
				userId: command.userId,
				error: result.error,
			});
		}

		this.#logger.log(
			`Inquiry submitted: userId=${command.userId}, category=${command.category}`,
		);
	}
}
