import { Inject, Injectable, Logger } from "@nestjs/common";

import { BillingLogEvent } from "../../application/observability/subscriptions/billing-log.events.js";
import { ApplyStoreSubscriptionEvent } from "../../application/use-cases/subscriptions/apply-store-subscription-event.use-case.js";
import { translateRevenueCatWebhook } from "./revenuecat-event.translator.js";

export interface RevenueCatWebhookInput {
  readonly body: unknown;
}

/** RevenueCat 웹훅 원문을 번역해 구독 이벤트 처리로 넘긴다. 형식이 틀린 원문은 받은 것으로 닫는다. */
@Injectable()
export class RevenueCatWebhookReceiver {
  readonly #logger = new Logger(RevenueCatWebhookReceiver.name);

  constructor(
    @Inject(ApplyStoreSubscriptionEvent)
    private readonly applyStoreSubscriptionEvent: Pick<ApplyStoreSubscriptionEvent, "execute">,
  ) {}

  async receive({ body }: RevenueCatWebhookInput): Promise<{ received: true }> {
    const translation = translateRevenueCatWebhook(body);
    if (translation.status === "invalid") {
      this.#logger.warn({
        event: BillingLogEvent.WEBHOOK_INVALID,
        eventType: translation.eventType,
        issueCount: translation.issueCount,
      });
      return { received: true };
    }
    await this.applyStoreSubscriptionEvent.execute(translation.event);
    return { received: true };
  }
}
