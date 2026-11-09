import { Logger } from "@nestjs/common";

import type {
  EmailDeliveryOutcome,
  EmailSenderPort,
} from "../../../application/ports/email/email-sender.port.js";
import type { EmailMessage } from "../../../domain/value-objects/email/email-message.vo.js";
import { EmailLogEvent } from "../../observability/email/email-log.events.js";

/** 실제로 보내지 않고 발송했다는 사실만 로그로 남긴다(개발·테스트). 수신자와 본문은 남기지 않는다. */
export class LogEmailSenderAdapter implements EmailSenderPort {
  readonly #logger = new Logger(LogEmailSenderAdapter.name);

  async send(message: EmailMessage): Promise<EmailDeliveryOutcome> {
    this.#logger.debug({ event: EmailLogEvent.DELIVERY_SIMULATED, kind: message.kind });
    return { status: "sent", providerMessageId: null };
  }
}
