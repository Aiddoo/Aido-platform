import { EmailMessage } from "../../../domain/value-objects/email/email-message.vo.js";
import {
  getInquiryHtml,
  getInquirySubject,
  getInquiryText,
  type InquiryTemplateData,
} from "../../templates/email/inquiry.template.js";
import {
  getPasswordResetHtml,
  getPasswordResetSubject,
  getPasswordResetText,
  type PasswordResetTemplateData,
} from "../../templates/email/password-reset.template.js";
import {
  getPasswordSetupHtml,
  getPasswordSetupSubject,
  getPasswordSetupText,
  type PasswordSetupTemplateData,
} from "../../templates/email/password-setup.template.js";
import {
  getVerificationCodeHtml,
  getVerificationCodeSubject,
  getVerificationCodeText,
  type VerificationCodeTemplateData,
} from "../../templates/email/verification-code.template.js";

export function createVerificationCodeEmail(
  to: string,
  data: VerificationCodeTemplateData,
  idempotencyKey?: string,
): EmailMessage {
  return EmailMessage.create({
    to,
    subject: getVerificationCodeSubject(),
    html: getVerificationCodeHtml(data),
    text: getVerificationCodeText(data),
    tags: [{ name: "type", value: "verification" }],
    idempotencyKey,
  });
}

export function createPasswordResetEmail(
  to: string,
  data: PasswordResetTemplateData,
  idempotencyKey?: string,
): EmailMessage {
  return EmailMessage.create({
    to,
    subject: getPasswordResetSubject(),
    html: getPasswordResetHtml(data),
    text: getPasswordResetText(data),
    tags: [{ name: "type", value: "password-reset" }],
    idempotencyKey,
  });
}

export function createPasswordSetupEmail(
  to: string,
  data: PasswordSetupTemplateData,
  idempotencyKey?: string,
): EmailMessage {
  return EmailMessage.create({
    to,
    subject: getPasswordSetupSubject(),
    html: getPasswordSetupHtml(data),
    text: getPasswordSetupText(data),
    tags: [{ name: "type", value: "password-setup" }],
    idempotencyKey,
  });
}

export function createInquiryEmail(to: string, data: InquiryTemplateData): EmailMessage {
  return EmailMessage.create({
    to,
    subject: getInquirySubject(data.categoryLabel),
    html: getInquiryHtml(data),
    text: getInquiryText(data),
    tags: [
      { name: "type", value: "inquiry" },
      { name: "category", value: data.category },
    ],
  });
}
