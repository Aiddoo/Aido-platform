import { type EmailSenderPort, type EmailSendResult } from "../../ports/email/email-sender.port.js";
import {
  createVerificationCodeEmail,
  createPasswordResetEmail,
  createPasswordSetupEmail,
  createInquiryEmail,
} from "../../services/email/email-message.factory.js";
import type { InquiryTemplateData } from "../../templates/email/inquiry.template.js";
import type { PasswordResetTemplateData } from "../../templates/email/password-reset.template.js";
import type { PasswordSetupTemplateData } from "../../templates/email/password-setup.template.js";
import type { VerificationCodeTemplateData } from "../../templates/email/verification-code.template.js";

/** 인증 및 문의 템플릿을 외부 이메일 공급자로 발송하는 공개 capability. */
export class TransactionalEmailSender {
  readonly #emailSender: Pick<EmailSenderPort, "send">;

  constructor(dependencies: { readonly emailSender: Pick<EmailSenderPort, "send"> }) {
    this.#emailSender = dependencies.emailSender;
  }

  sendVerificationCode(
    to: string,
    data: VerificationCodeTemplateData,
    idempotencyKey?: string,
  ): Promise<EmailSendResult> {
    return this.#emailSender.send(createVerificationCodeEmail(to, data, idempotencyKey));
  }

  sendPasswordResetCode(
    to: string,
    data: PasswordResetTemplateData,
    idempotencyKey?: string,
  ): Promise<EmailSendResult> {
    return this.#emailSender.send(createPasswordResetEmail(to, data, idempotencyKey));
  }

  sendPasswordSetupCode(
    to: string,
    data: PasswordSetupTemplateData,
    idempotencyKey?: string,
  ): Promise<EmailSendResult> {
    return this.#emailSender.send(createPasswordSetupEmail(to, data, idempotencyKey));
  }

  sendInquiry(to: string, data: InquiryTemplateData): Promise<EmailSendResult> {
    return this.#emailSender.send(createInquiryEmail(to, data));
  }
}
