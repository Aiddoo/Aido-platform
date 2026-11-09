import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

import { BillingAlertKey } from "../../application/observability/subscriptions/billing-alerts.js";
import { BillingLogEvent } from "../../application/observability/subscriptions/billing-log.events.js";
import { ApplyStoreSubscriptionEvent } from "../../application/use-cases/subscriptions/apply-store-subscription-event.use-case.js";
import { translateRevenueCatWebhook } from "./revenuecat-event.translator.js";

export interface RevenueCatWebhookInput {
  readonly body: unknown;
}

// 계약과 다른 원문은 다시 보내도 같으므로 받은 것으로 닫고 사람이 보게 한다

@Injectable()
export class RevenueCatWebhookReceiver {
  readonly #logger = new Logger(RevenueCatWebhookReceiver.name);

  constructor(
    @Inject(ApplyStoreSubscriptionEvent)
    private readonly applyStoreSubscriptionEvent: Pick<ApplyStoreSubscriptionEvent, "execute">,
    @Inject(OPERATIONAL_ALERT) private readonly alert: OperationalAlertPort,
  ) {}

  async receive({ body }: RevenueCatWebhookInput): Promise<{ received: true }> {
    const translation = translateRevenueCatWebhook(body);
    if (translation.status === "invalid") {
      this.#logger.warn({
        event: BillingLogEvent.WEBHOOK_INVALID,
        eventType: translation.eventType,
        issueCount: translation.issueCount,
      });
      this.alert.raise({
        key: BillingAlertKey.WEBHOOK_INVALID,
        severity: "warning",
        message: "RevenueCat 웹훅 원문이 계약과 달라 처리하지 않았습니다",
        tags: { eventType: translation.eventType ?? "unknown" },
        details: { issueCount: translation.issueCount },
      });
      return { received: true };
    }
    await this.applyStoreSubscriptionEvent.execute(translation.event);
    return { received: true };
  }
}
