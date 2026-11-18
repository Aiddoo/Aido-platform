import { EmailMessageId } from "#api/modules/notification/email-messages/domain/email-message-id.vo";
import {
  type CreateEmailMessageParams,
  EmailMessage,
} from "#api/modules/notification/email-messages/domain/email-message.aggregate";

export const EMAIL_MESSAGE_FIXTURE_RECIPIENT = "private@example.com";
export const EMAIL_MESSAGE_FIXTURE_CODE = "987654";

export function createEmailMessageFixture(
  overrides: Partial<CreateEmailMessageParams> = {},
): EmailMessage {
  return EmailMessage.create({
    id: EmailMessageId.reconstitute("email-message-fixture"),
    kind: "verification",
    to: EMAIL_MESSAGE_FIXTURE_RECIPIENT,
    subject: "인증 코드",
    html: `<p>${EMAIL_MESSAGE_FIXTURE_CODE}</p>`,
    text: EMAIL_MESSAGE_FIXTURE_CODE,
    tags: [{ name: "type", value: "verification" }],
    ...overrides,
  });
}
