import { timingSafeEqual } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import type { Request } from "express";

import { BillingLogEvent } from "#api/modules/billing/application/observability/subscriptions/billing-log.events";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

/**
 * RevenueCat Webhook 서명 검증 가드
 *
 * Dashboard에서 설정한 Authorization 헤더를 검증한다.
 *
 * - webhook secret 미설정 시 개발 환경으로 간주하여 통과
 * - timing-safe comparison으로 타이밍 공격 방지
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  readonly #logger = new Logger(WebhookSignatureGuard.name);

  constructor(private readonly config: TypedConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const webhookSecret = this.config.revenuecat.webhookSecret;

    // webhook secret이 미설정이면 환경에 따라 분기
    if (!webhookSecret) {
      if (this.config.isProduction) {
        this.#logger.error({ event: BillingLogEvent.WEBHOOK_SECRET_MISSING, action: "rejected" });
        throw new ApplicationException(ErrorCode.SUBSCRIPTION_1601);
      }
      this.#logger.warn({ event: BillingLogEvent.WEBHOOK_SECRET_MISSING, action: "skipped" });
      return true;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      this.#logger.warn({
        event: BillingLogEvent.WEBHOOK_AUTHORIZATION_REJECTED,
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
        event: BillingLogEvent.WEBHOOK_AUTHORIZATION_REJECTED,
        reason: "mismatch",
      });
      throw new ApplicationException(ErrorCode.SUBSCRIPTION_1601);
    }

    return true;
  }
}
