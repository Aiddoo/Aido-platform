import { timingSafeEqual } from "node:crypto";

import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from "@nestjs/common";
import type { Request } from "express";

import { invalidWebhookSignature } from "../../../application/subscriptions.errors.js";
import { SubscriptionLogEvent } from "../../../application/subscriptions.log-events.js";
import {
  billingSubscriptionsConfig,
  type BillingSubscriptionsConfig,
  type WebhookSignatureCheck,
} from "../../../billing-subscriptions.config.js";

/**
 * Dashboard에서 설정한 Authorization 헤더를 timing-safe로 검증한다.
 * 비밀이 없으면 개발 환경만 통과시키고 스테이징·운영은 모두 거절한다(billing-subscriptions.config.ts).
 */
@Injectable()
export class RevenueCatWebhookSignatureGuard implements CanActivate {
  readonly #logger = new Logger(RevenueCatWebhookSignatureGuard.name);
  readonly #signature: WebhookSignatureCheck;

  constructor(
    @Inject(billingSubscriptionsConfig.KEY)
    config: Pick<BillingSubscriptionsConfig, "webhookSignature">,
  ) {
    this.#signature = config.webhookSignature;
  }

  canActivate(context: ExecutionContext): boolean {
    const signature = this.#signature;
    if (signature.mode === "skip") {
      this.#logger.warn({ event: SubscriptionLogEvent.WEBHOOK_SECRET_MISSING, action: "skipped" });
      return true;
    }
    if (signature.mode === "reject") {
      this.#logger.error({
        event: SubscriptionLogEvent.WEBHOOK_SECRET_MISSING,
        action: "rejected",
      });
      throw invalidWebhookSignature();
    }

    const authHeader = context.switchToHttp().getRequest<Request>().headers.authorization;
    if (!authHeader) {
      this.#logger.warn({
        event: SubscriptionLogEvent.WEBHOOK_AUTHORIZATION_REJECTED,
        reason: "missing",
      });
      throw invalidWebhookSignature();
    }

    // Bearer prefix 포함/미포함 모두 지원 (RevenueCat은 설정값을 그대로 전송)
    const candidates = [`Bearer ${signature.secret}`, signature.secret];
    const authBuffer = Buffer.from(authHeader);

    const isValid = candidates.some((candidate) => {
      const candidateBuffer = Buffer.from(candidate);
      return (
        authBuffer.length === candidateBuffer.length && timingSafeEqual(authBuffer, candidateBuffer)
      );
    });

    if (!isValid) {
      this.#logger.warn({
        event: SubscriptionLogEvent.WEBHOOK_AUTHORIZATION_REJECTED,
        reason: "mismatch",
      });
      throw invalidWebhookSignature();
    }

    return true;
  }
}
