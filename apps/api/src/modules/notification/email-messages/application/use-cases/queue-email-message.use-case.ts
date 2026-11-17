import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { resolveEmailPriority } from "../../domain/email-budget.domain-service.js";
import type { EmailMessage } from "../../domain/email-message.aggregate.js";
import { EmailMessageLogEvent } from "../email-messages.log-events.js";
import type { EmailBudgetPort } from "../ports/email-budget.port.js";
import type { EmailDeliveryQueuePort } from "../ports/email-delivery-queue.port.js";

/**
 * 발송 요청의 결과. queued는 발송 큐에 담았다는 뜻이고 실제 발송은 비동기로 끝난다.
 * 재시도·최종 실패 처리는 발송 큐(worker)가 맡으므로 호출자는 이 결과로 재시도하지 않는다.
 */
export type EmailDispatch =
  | { readonly status: "queued" }
  | { readonly status: "rejected"; readonly reason: "budget_exhausted" | "queue_unavailable" };

interface QueueEmailMessageDependencies {
  readonly queue: Pick<EmailDeliveryQueuePort, "enqueue">;
  readonly budget: Pick<EmailBudgetPort, "reserve" | "release">;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

// 렌더한 메일의 예산을 예약하고 email-delivery.v1에 담는다. 담지 못하거나 이미 담긴 건은 예약을 돌려준다
export class QueueEmailMessageUseCase {
  readonly #dependencies: QueueEmailMessageDependencies;

  constructor(dependencies: QueueEmailMessageDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(message: EmailMessage): Promise<EmailDispatch> {
    const priority = resolveEmailPriority(message.kind);
    const reservation = await this.#dependencies.budget.reserve(priority);
    if (reservation === "exhausted") {
      this.#dependencies.logger.warn({
        event: EmailMessageLogEvent.DELIVERY_REJECTED,
        kind: message.kind,
        reason: "budget_exhausted",
      });
      return { status: "rejected", reason: "budget_exhausted" };
    }

    try {
      const enqueued = await this.#dependencies.queue.enqueue({
        deliveryId: message.id,
        message,
      });
      if (enqueued === "duplicate") {
        await this.#dependencies.budget.release();
      }
    } catch {
      await this.#dependencies.budget.release();
      this.#dependencies.logger.warn({
        event: EmailMessageLogEvent.DELIVERY_REJECTED,
        kind: message.kind,
        reason: "queue_unavailable",
      });
      return { status: "rejected", reason: "queue_unavailable" };
    }

    this.#dependencies.logger.log({
      event: EmailMessageLogEvent.DELIVERY_QUEUED,
      kind: message.kind,
      priority,
    });
    return { status: "queued" };
  }
}
