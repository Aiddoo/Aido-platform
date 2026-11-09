import { Inject, Injectable, Logger } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";
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

@Injectable()
export class RevenueCatWebhookReceiver {
  readonly #logger = new Logger(RevenueCatWebhookReceiver.name);

  constructor(
    @Inject(ApplyStoreSubscriptionEvent)
    private readonly applyStoreSubscriptionEvent: Pick<ApplyStoreSubscriptionEvent, "execute">,
    @Inject(OPERATIONAL_ALERT) private readonly alert: OperationalAlertPort,
    @Inject(TypedConfigService) private readonly config: Pick<TypedConfigService, "appEnv">,
  ) {}

  async receive({ body }: RevenueCatWebhookInput): Promise<{ received: true }> {
    // 웹훅 연동이 하나라 Test Store 구매도 운영으로 온다. 운영은 결제 없는 구매에 프리미엄을 주지 않는다
    const translation = translateRevenueCatWebhook(body, {
      acceptsTestStore: this.config.appEnv !== "production",
    });
    if (translation.status === "skipped") {
      this.#logger.log({
        event: BillingLogEvent.WEBHOOK_SKIPPED,
        reason: translation.reason,
        eventType: translation.eventType,
        eventId: translation.eventId,
      });
      return { received: true };
    }
    // 계약과 다른 원문은 다시 보내도 같으므로 받은 것으로 닫고 사람이 보게 한다
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
