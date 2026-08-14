import type { InquiryTemplateData } from "../../domain/templates/inquiry.template";
import type { PasswordResetTemplateData } from "../../domain/templates/password-reset.template";
import type { PasswordSetupTemplateData } from "../../domain/templates/password-setup.template";
import type { VerificationCodeTemplateData } from "../../domain/templates/verification-code.template";
import { EmailMessage } from "../../domain/value-objects/email-message.vo";
import { type EmailSenderPort, type EmailSendResult } from "../ports/email-sender.port";

/** 인증 및 문의 템플릿을 외부 이메일 공급자로 발송하는 공개 capability. */
export class TransactionalEmailSender {
	constructor(private readonly sender: EmailSenderPort) {}

	sendVerificationCode(
		to: string,
		data: VerificationCodeTemplateData,
		idempotencyKey?: string,
	): Promise<EmailSendResult> {
		return this.sender.send(EmailMessage.verificationCode(to, data, idempotencyKey));
	}

	sendPasswordResetCode(
		to: string,
		data: PasswordResetTemplateData,
		idempotencyKey?: string,
	): Promise<EmailSendResult> {
		return this.sender.send(EmailMessage.passwordReset(to, data, idempotencyKey));
	}

	sendPasswordSetupCode(
		to: string,
		data: PasswordSetupTemplateData,
		idempotencyKey?: string,
	): Promise<EmailSendResult> {
		return this.sender.send(EmailMessage.passwordSetup(to, data, idempotencyKey));
	}

	sendInquiry(to: string, data: InquiryTemplateData): Promise<EmailSendResult> {
		return this.sender.send(EmailMessage.inquiry(to, data));
	}
}
