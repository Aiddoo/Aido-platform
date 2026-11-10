import { timingSafeEqual } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import type { Request } from "express";

import { appConfig } from "#api/platform/config/app.config";
import { ApplicationException } from "#api/shared/application/application.exception";

import { SubscriptionLogEvent } from "../../../application/subscriptions.log-events.js";
import { billingSubscriptionsConfig } from "../../../billing-subscriptions.config.js";

/**
 * RevenueCat Webhook 서명 검증 가드
 *
 * Dashboard에서 설정한 Authorization 헤더를 검증한다.
 *
 * - webhook secret 미설정 시 개발 환경으로 간주하여 통과
 * - timing-safe comparison으로 타이밍 공격 방지
 */
@Injectable()
export class RevenueCatWebhookSignatureGuard implements CanActivate {
  readonly #logger = new Logger(RevenueCatWebhookSignatureGuard.name);

  readonly #webhookSecret: string | undefined;
  readonly #isProduction: boolean;

  constructor(
    @Inject(billingSubscriptionsConfig.KEY)
    billing: Pick<ConfigType<typeof billingSubscriptionsConfig>, "revenuecat">,
    @Inject(appConfig.KEY) app: Pick<ConfigType<typeof appConfig>, "isProduction">,
  ) {
    this.#webhookSecret = billing.revenuecat.webhookSecret;
    this.#isProduction = app.isProduction;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const webhookSecret = this.#webhookSecret;

    if (!webhookSecret) {
      if (this.#isProduction) {
        this.#logger.error({
          event: SubscriptionLogEvent.WEBHOOK_SECRET_MISSING,
          action: "rejected",
        });
        throw new ApplicationException(ErrorCode.SUBSCRIPTION_1601);
      }
      this.#logger.warn({ event: SubscriptionLogEvent.WEBHOOK_SECRET_MISSING, action: "skipped" });
      return true;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      this.#logger.warn({
        event: SubscriptionLogEvent.WEBHOOK_AUTHORIZATION_REJECTED,
        reason: "missing",
      });
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1601);
    }

    // Bearer prefix 포함/미포함 모두 지원 (RevenueCat은 설정값을 그대로 전송)
    const candidates = [`Bearer ${webhookSecret}`, webhookSecret];
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
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1601);
    }

    return true;
  }
}
