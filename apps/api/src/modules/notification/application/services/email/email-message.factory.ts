import { createHash } from "node:crypto";

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
  getUserReportHtml,
  getUserReportSubject,
  getUserReportText,
  type UserReportTemplateData,
} from "../../templates/email/user-report.template.js";
import {
  getVerificationCodeHtml,
  getVerificationCodeSubject,
  getVerificationCodeText,
  type VerificationCodeTemplateData,
} from "../../templates/email/verification-code.template.js";

export function createVerificationCodeEmail(
  to: string,
  data: VerificationCodeTemplateData,
): EmailMessage {
  return EmailMessage.create({
    kind: "verification",
    to,
    subject: getVerificationCodeSubject(),
    html: getVerificationCodeHtml(data),
    text: getVerificationCodeText(data),
    tags: [{ name: "type", value: "verification" }],
  });
}

export function createPasswordResetEmail(
  to: string,
  data: PasswordResetTemplateData,
): EmailMessage {
  return EmailMessage.create({
    kind: "password-reset",
    to,
    subject: getPasswordResetSubject(),
    html: getPasswordResetHtml(data),
    text: getPasswordResetText(data),
    tags: [{ name: "type", value: "password-reset" }],
  });
}

export function createPasswordSetupEmail(
  to: string,
  data: PasswordSetupTemplateData,
): EmailMessage {
  return EmailMessage.create({
    kind: "password-setup",
    to,
    subject: getPasswordSetupSubject(),
    html: getPasswordSetupHtml(data),
    text: getPasswordSetupText(data),
    tags: [{ name: "type", value: "password-setup" }],
  });
}

export function createInquiryEmail(to: string, data: InquiryTemplateData): EmailMessage {
  return EmailMessage.create({
    kind: "inquiry",
    to,
    subject: getInquirySubject(data.categoryLabel),
    html: getInquiryHtml(data),
    text: getInquiryText(data),
    tags: [
      { name: "type", value: "inquiry" },
      { name: "category", value: data.category },
    ],
    // 응답을 못 받은 재전송이 운영자에게 두 번 가지 않게 같은 내용은 공급자가 한 번만 받는다.
    idempotencyKey: `inquiry:${createHash("sha256")
      .update(JSON.stringify([to, data.userEmail, data.category, data.content]))
      .digest("hex")}`,
  });
}

export function createUserReportEmail(to: string, data: UserReportTemplateData): EmailMessage {
  return EmailMessage.create({
    kind: "user-report",
    to,
    subject: getUserReportSubject(data),
    html: getUserReportHtml(data),
    text: getUserReportText(data),
    tags: [
      { name: "type", value: "user-report" },
      { name: "reason", value: data.reason },
    ],
    // 같은 신고를 다시 보내도 운영자에게 한 번만 가도록 신고 ID를 멱등 키로 쓴다.
    idempotencyKey: `user-report:${data.reportId}`,
  });
}
