import { timingSafeEqual } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";

import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import type {
  StoreWebhookHeaders,
  StoreWebhookPort,
} from "../../../application/ports/store-webhook.port.js";
import { SubscriptionAlerts } from "../../../application/subscriptions.alerts.js";
import { SubscriptionLogEvent } from "../../../application/subscriptions.log-events.js";
import {
  billingSubscriptionsConfig,
  type BillingSubscriptionsConfig,
} from "../../../billing-subscriptions.config.js";
import type { StoreSubscriptionEvent } from "../../../domain/store-subscription.event.js";
import { translateRevenueCatWebhook } from "./revenuecat-webhook-translator.adapter.js";

/**
 * RevenueCat 웹훅. Dashboard에서 설정한 Authorization 헤더를 timing-safe로 검증하고, 원문을 공급자 중립 이벤트로
 * 바꾼다. 비밀이 없으면 개발 환경만 통과시키고 스테이징·운영은 모두 거절한다(billing-subscriptions.config.ts).
 */
@Injectable()
export class RevenueCatStoreWebhookAdapter implements StoreWebhookPort {
  readonly #logger = new Logger(RevenueCatStoreWebhookAdapter.name);
  readonly #alert: OperationalAlertPort;
  readonly #config: Pick<
    BillingSubscriptionsConfig,
    "webhookSignature" | "acceptsTestStorePurchases"
  >;

  constructor(
    alert: OperationalAlertPort,
    @Inject(billingSubscriptionsConfig.KEY)
    config: Pick<BillingSubscriptionsConfig, "webhookSignature" | "acceptsTestStorePurchases">,
  ) {
    this.#alert = alert;
    this.#config = config;
  }

  authenticate(headers: StoreWebhookHeaders): boolean {
    const signature = this.#config.webhookSignature;
    if (signature.mode === "skip") {
      this.#logger.warn({ event: SubscriptionLogEvent.WEBHOOK_SECRET_MISSING, action: "skipped" });
      return true;
    }
    if (signature.mode === "reject") {
      this.#logger.error({
        event: SubscriptionLogEvent.WEBHOOK_SECRET_MISSING,
        action: "rejected",
      });
      return false;
    }
    const authorization = headers.authorization;
    if (typeof authorization !== "string" || authorization === "") {
      this.#logger.warn({
        event: SubscriptionLogEvent.WEBHOOK_AUTHORIZATION_REJECTED,
        reason: "missing",
      });
      return false;
    }
    if (!matchesSecret(authorization, signature.secret)) {
      this.#logger.warn({
        event: SubscriptionLogEvent.WEBHOOK_AUTHORIZATION_REJECTED,
        reason: "mismatch",
      });
      return false;
    }
    return true;
  }

  translate(body: unknown): StoreSubscriptionEvent | null {
    const translation = translateRevenueCatWebhook(body, {
      acceptsTestStore: this.#config.acceptsTestStorePurchases,
    });
    if (translation.status === "skipped") {
      this.#logger.log({
        event: SubscriptionLogEvent.WEBHOOK_SKIPPED,
        reason: translation.reason,
        eventType: translation.eventType,
        eventId: translation.eventId,
      });
      return null;
    }
    // 계약과 다른 원문은 다시 보내도 같으므로 받은 것으로 닫고 사람이 보게 한다
    if (translation.status === "invalid") {
      this.#logger.warn({
        event: SubscriptionLogEvent.WEBHOOK_INVALID,
        eventType: translation.eventType,
        issueCount: translation.issueCount,
      });
      this.#alert.raise({
        ...SubscriptionAlerts.WEBHOOK_INVALID,
        tags: { eventType: translation.eventType ?? "unknown" },
        details: { issueCount: translation.issueCount },
      });
      return null;
    }
    return translation.event;
  }
}

// RevenueCat은 설정값을 그대로 보내므로 Bearer를 붙인 값과 붙이지 않은 값을 모두 받는다
function matchesSecret(authorization: string, secret: string): boolean {
  const received = Buffer.from(authorization);
  return [`Bearer ${secret}`, secret].some((candidate) => {
    const expected = Buffer.from(candidate);
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}
