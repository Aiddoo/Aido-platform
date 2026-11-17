import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { resolveEmailPriority } from "../../domain/email-budget.domain-service.js";
import { OPERATOR_EMAIL_LOCALE } from "../../domain/email-delivery.constants.js";
import { toEmailMessage } from "../email-message.mapper.js";
import { EmailMessageLogEvent } from "../email-messages.log-events.js";
import type { EmailBudgetPort } from "../ports/email-budget.port.js";
import type { EmailSenderPort } from "../ports/email-sender.port.js";
import type {
  EmailTemplateRendererPort,
  InquiryTemplateData,
} from "../ports/email-template-renderer.port.js";

/** 요청 안에서 보낸 결과. 보내지 못하면 호출자가 사용자에게 실패를 알려 다시 보내게 한다. */
export type EmailSendResult =
  | { readonly status: "sent" }
  | { readonly status: "rejected"; readonly reason: "budget_exhausted" | "delivery_failed" };

export interface SendInquiryEmailCommand {
  readonly to: string;
  readonly templateData: InquiryTemplateData;
}

interface SendInquiryEmailDependencies {
  readonly sender: Pick<EmailSenderPort, "send">;
  readonly budget: Pick<EmailBudgetPort, "reserve" | "release" | "settleProviderQuotaExhausted">;
  readonly renderer: Pick<EmailTemplateRendererPort, "render">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

/**
 * 문의는 DB에 남지 않아 메일이 유일한 전달 경로다. 큐로 미루면 재시도를 다 쓴 문의가 말없이
 * 사라지므로 요청 안에서 한 번만 보내고, 실패는 그대로 돌려줘 사용자가 다시 보내게 한다.
 */
export class SendInquiryEmailUseCase {
  readonly #dependencies: SendInquiryEmailDependencies;

  constructor(dependencies: SendInquiryEmailDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendInquiryEmailCommand): Promise<EmailSendResult> {
    const template = { kind: "inquiry", data: command.templateData } as const;
    const body = await this.#dependencies.renderer.render(template, OPERATOR_EMAIL_LOCALE);
    const message = toEmailMessage(command.to, template, body);
    const reservation = await this.#dependencies.budget.reserve(resolveEmailPriority(message.kind));
    if (reservation === "exhausted") {
      this.#dependencies.logger.warn({
        event: EmailMessageLogEvent.DELIVERY_REJECTED,
        kind: message.kind,
        reason: "budget_exhausted",
      });
      return { status: "rejected", reason: "budget_exhausted" };
    }

    const outcome = await this.#dependencies.sender.send(message);
    if (outcome.status === "sent") {
      return { status: "sent" };
    }
    if (outcome.reason === "quota_exhausted") {
      await this.#dependencies.budget.settleProviderQuotaExhausted(outcome.scope);
    } else {
      await this.#dependencies.budget.release();
    }
    this.#dependencies.logger.warn({
      event: EmailMessageLogEvent.DELIVERY_REJECTED,
      kind: message.kind,
      reason: outcome.reason,
    });
    return { status: "rejected", reason: "delivery_failed" };
  }
}
