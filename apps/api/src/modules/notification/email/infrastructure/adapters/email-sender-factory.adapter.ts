import type { EmailProviderId } from "#api/platform/config/schemas/email.schema";

import type { EmailSenderPort } from "../../application/ports/email-sender.port.js";
import { LogEmailSenderAdapter } from "./log-email-sender.adapter.js";
import type { NestMailEmailSenderAdapter } from "./nest-mail-email-sender.adapter.js";

/** 공급자를 더하려면 EmailProviderId와 이 표, nest-mail-module.config의 전송 표에 한 줄씩 더한다. */
const senders = {
  resend: (nestMail) => nestMail,
  log: () => new LogEmailSenderAdapter(),
} satisfies Record<EmailProviderId, (nestMail: NestMailEmailSenderAdapter) => EmailSenderPort>;

export function selectEmailSender(
  provider: EmailProviderId,
  nestMail: NestMailEmailSenderAdapter,
): EmailSenderPort {
  return senders[provider](nestMail);
}
