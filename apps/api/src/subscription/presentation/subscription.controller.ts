import { Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";

import { Public } from "@/auth/presentation/decorators";

import { HandleWebhookEventUseCase } from "../application/use-cases/handle-webhook-event/handle-webhook-event.use-case";
import { WebhookSignatureGuard } from "../infrastructure/guards/webhook-signature.guard";

/**
 * RevenueCat Webhook 컨트롤러
 *
 * RevenueCat에서 전송하는 구독 이벤트 웹훅을 수신합니다.
 *
 * - JWT 인증 건너뜀 (@Public)
 * - Rate limiting 건너뜀 (@SkipThrottle)
 * - Authorization 헤더로 서명 검증 (WebhookSignatureGuard)
 * - 항상 200 OK 반환 (RevenueCat는 non-2xx 시 재시도하므로) — Lock 경합(429)만 예외
 *
 * 검증·처리·실패 보고 오케스트레이션은 endpoint use-case가 소유한다.
 */
@Controller("webhooks")
@SkipThrottle()
export class SubscriptionController {
	constructor(private readonly handleWebhookEventUseCase: HandleWebhookEventUseCase) {}

	@Post("revenuecat")
	@Public()
	@ApiExcludeEndpoint()
	@UseGuards(WebhookSignatureGuard)
	@HttpCode(HttpStatus.OK)
	handleRevenueCatWebhook(@Req() request: Request): Promise<{ received: true }> {
		return this.handleWebhookEventUseCase.execute(request.body);
	}
}
