import { revenueCatWebhookPayloadSchema } from "@aido/validators";
import {
	Controller,
	HttpCode,
	HttpStatus,
	Logger,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import * as Sentry from "@sentry/nestjs";
import type { Request } from "express";

import { Public } from "@/modules/auth/decorators/public.decorator";

import { WebhookSignatureGuard } from "./guards/webhook-signature.guard";
import { SubscriptionService } from "./subscription.service";

/**
 * RevenueCat Webhook 컨트롤러
 *
 * RevenueCat에서 전송하는 구독 이벤트 웹훅을 수신합니다.
 *
 * - JWT 인증 건너뜀 (@Public)
 * - Rate limiting 건너뜀 (@SkipThrottle)
 * - Authorization 헤더로 서명 검증 (WebhookSignatureGuard)
 * - 항상 200 OK 반환 (RevenueCat는 non-2xx 시 재시도하므로)
 */
@Controller("webhooks")
@SkipThrottle()
export class SubscriptionController {
	readonly #logger = new Logger(SubscriptionController.name);

	constructor(private readonly subscriptionService: SubscriptionService) {}

	@Post("revenuecat")
	@Public()
	@UseGuards(WebhookSignatureGuard)
	@HttpCode(HttpStatus.OK)
	async handleRevenueCatWebhook(
		@Req() request: Request,
	): Promise<{ received: true }> {
		// 1. Zod 검증
		const parseResult = revenueCatWebhookPayloadSchema.safeParse(request.body);

		if (!parseResult.success) {
			this.#logger.warn(
				`Invalid webhook payload: ${JSON.stringify(parseResult.error.issues)}`,
			);
			return { received: true };
		}

		// 2. 서비스 호출 (에러가 발생해도 항상 200 OK 반환)
		try {
			await this.subscriptionService.handleWebhookEvent(parseResult.data);
		} catch (error) {
			Sentry.captureException(error);
			this.#logger.error(
				`Failed to process webhook event: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}

		return { received: true };
	}
}
