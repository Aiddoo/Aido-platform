import { Logger } from "@nestjs/common";

import {
  EmailSenderPort,
  type EmailDeliveryOutcome,
} from "../../application/ports/email-sender.port.js";
import type { EmailMessage } from "../../domain/email-message.vo.js";
import { EmailLogEvent } from "./email-provider.log-events.js";

/** 실제로 보내지 않고 발송했다는 사실만 로그로 남긴다(개발·테스트). 수신자와 본문은 남기지 않는다. */
export class LogEmailSenderAdapter extends EmailSenderPort {
  readonly #logger = new Logger(LogEmailSenderAdapter.name);

  async send(message: EmailMessage): Promise<EmailDeliveryOutcome> {
    this.#logger.debug({ event: EmailLogEvent.DELIVERY_SIMULATED, kind: message.kind });
    return { status: "sent", providerMessageId: null };
  }
}
