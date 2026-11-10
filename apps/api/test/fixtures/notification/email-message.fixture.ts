import {
  EmailMessage,
  type EmailMessageProps,
} from "#api/modules/notification/email/domain/email-message.vo";

export const EMAIL_MESSAGE_FIXTURE_RECIPIENT = "private@example.com";
export const EMAIL_MESSAGE_FIXTURE_CODE = "987654";

export function createEmailMessageFixture(
  overrides: Partial<EmailMessageProps> = {},
): EmailMessage {
  return EmailMessage.create({
    kind: "verification",
    to: EMAIL_MESSAGE_FIXTURE_RECIPIENT,
    subject: "인증 코드",
    html: `<p>${EMAIL_MESSAGE_FIXTURE_CODE}</p>`,
    text: EMAIL_MESSAGE_FIXTURE_CODE,
    tags: [{ name: "type", value: "verification" }],
    ...overrides,
  });
}
