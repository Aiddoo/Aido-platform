import type { EmailBudgetReservation } from "#api/modules/notification/email-messages/application/ports/email-budget.port";
import {
  type EmailDelivery,
  EmailDeliveryQueuePort,
} from "#api/modules/notification/email-messages/application/ports/email-delivery-queue.port";
import type {
  EmailDeliveryOutcome,
  EmailQuotaScope,
} from "#api/modules/notification/email-messages/application/ports/email-sender.port";
import type { EmailMessage } from "#api/modules/notification/email-messages/domain/email-message.vo";

// 담은 발송 건을 남긴다. failure를 두면 큐가 내려간 것처럼 던지고, result로 중복 담기를 흉내 낸다
export class RecordingEmailDeliveryQueue extends EmailDeliveryQueuePort {
  readonly deliveries: EmailDelivery[] = [];
  failure: Error | null = null;
  result: "queued" | "duplicate" = "queued";

  async enqueue(delivery: EmailDelivery): Promise<"queued" | "duplicate"> {
    if (this.failure != null) {
      throw this.failure;
    }
    this.deliveries.push(delivery);
    return this.result;
  }
}

// 보낸 메일을 남기고 outcome을 그대로 돌려준다
export class RecordingEmailSender {
  readonly messages: EmailMessage[] = [];
  outcome: EmailDeliveryOutcome = { status: "sent", providerMessageId: "id-1" };

  async send(message: EmailMessage): Promise<EmailDeliveryOutcome> {
    this.messages.push(message);
    return this.outcome;
  }
}

// 예약한 중요도·돌려준 횟수·한도 정산을 남긴다
export class RecordingEmailBudget {
  readonly reserved: string[] = [];
  readonly settled: EmailQuotaScope[] = [];
  releases = 0;
  reservation: EmailBudgetReservation = "reserved";

  async settleProviderQuotaExhausted(scope: EmailQuotaScope): Promise<void> {
    this.settled.push(scope);
  }

  async reserve(priority: string): Promise<EmailBudgetReservation> {
    this.reserved.push(priority);
    return this.reservation;
  }

  async release(): Promise<void> {
    this.releases += 1;
  }
}
