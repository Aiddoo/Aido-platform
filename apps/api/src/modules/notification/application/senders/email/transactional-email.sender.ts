import type { InquiryTemplateData } from "../../../domain/templates/email/inquiry.template.js";
import type { PasswordResetTemplateData } from "../../../domain/templates/email/password-reset.template.js";
import type { PasswordSetupTemplateData } from "../../../domain/templates/email/password-setup.template.js";
import type { VerificationCodeTemplateData } from "../../../domain/templates/email/verification-code.template.js";
import { EmailMessage } from "../../../domain/value-objects/email/email-message.vo.js";
import { type EmailSenderPort, type EmailSendResult } from "../../ports/email/email-sender.port.js";

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
