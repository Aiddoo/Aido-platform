import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import type { EmailKind } from "../../domain/email-delivery.constants.js";
import type { EmailMessage } from "../../domain/email-message.vo.js";
import { EmailAlerts } from "../email.alerts.js";
import { EmailDeliveryLogEvent } from "../email.log-events.js";
import type { EmailBudgetPort } from "../ports/email-budget.port.js";
import type { EmailSenderPort } from "../ports/email-sender.port.js";

/** 다시 시도하면 보낼 수 있는 실패. 큐가 backoff로 다시 부른다. */
export class EmailDeliveryRetryableError extends Error {
  readonly kind: EmailKind;
  readonly reason: string;

  constructor(kind: EmailKind, reason: string) {
    super(`Email delivery failed: ${kind} ${reason}`);
    this.kind = kind;
    this.reason = reason;
    this.name = EmailDeliveryRetryableError.name;
  }
}

export interface DeliverEmailInput {
  readonly deliveryId: string;
  readonly message: EmailMessage;
  /** 마지막 시도라 더 이상 큐가 다시 부르지 않는다 */
  readonly isFinalAttempt: boolean;
}

interface DeliverEmailDependencies {
  readonly sender: Pick<EmailSenderPort, "send">;
  readonly budget: Pick<EmailBudgetPort, "release" | "settleProviderQuotaExhausted">;
  readonly alert: Pick<OperationalAlertPort, "raise">;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/**
 * 큐에서 꺼낸 이메일 한 통을 공급자로 보낸다. 예약한 예산은 보내졌거나 다시 시도할 때는 그대로 두고,
 * 보내지 못하고 끝날 때만 돌려준다. 재시도는 큐(pg-boss)가 하므로 여기서는 던지기만 한다.
 */
export class DeliverEmailUseCase {
  readonly #dependencies: DeliverEmailDependencies;

  constructor(dependencies: DeliverEmailDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeliverEmailInput): Promise<void> {
    const { deliveryId, message, isFinalAttempt } = input;
    const outcome = await this.#dependencies.sender.send(message);
    const fields = { kind: message.kind, deliveryId };

    if (outcome.status === "sent") {
      this.#dependencies.logger.log({ event: EmailDeliveryLogEvent.DELIVERY_SENT, ...fields });
      return;
    }

    if (outcome.reason === "quota_exhausted") {
      await this.#dependencies.budget.settleProviderQuotaExhausted(outcome.scope);
      this.#dependencies.logger.warn({
        event: EmailDeliveryLogEvent.DELIVERY_DROPPED,
        ...fields,
        reason: outcome.reason,
      });
      return;
    }

    if (outcome.retryable && !isFinalAttempt) {
      this.#dependencies.logger.warn({
        event: EmailDeliveryLogEvent.DELIVERY_RETRY_SCHEDULED,
        ...fields,
        reason: outcome.reason,
      });
      throw new EmailDeliveryRetryableError(message.kind, outcome.reason);
    }

    await this.#dependencies.budget.release();
    this.#dependencies.logger.warn({
      event: EmailDeliveryLogEvent.DELIVERY_DROPPED,
      ...fields,
      reason: outcome.reason,
    });
    this.#dependencies.alert.raise({
      ...(outcome.retryable ? EmailAlerts.DELIVERY_RETRY_EXHAUSTED : EmailAlerts.DELIVERY_REJECTED),
      tags: { kind: message.kind, reason: outcome.reason },
    });
  }
}
