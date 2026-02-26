import { ErrorCode } from "@aido/errors";
import {
	type RevenueCatWebhookPayload,
	revenueCatWebhookPayloadSchema,
} from "@aido/validators";
import {
	Controller,
	HttpCode,
	HttpStatus,
	Inject,
	Logger,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import * as Sentry from "@sentry/nestjs";
import type { Request } from "express";

import { BusinessException } from "@/common/exception/services/business-exception.service";
import {
	type AdminNotifier,
	PAYMENT_NOTIFIER,
} from "@/modules/admin-notification/providers/admin-notifier.interface";
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

	constructor(
		private readonly subscriptionService: SubscriptionService,
		@Inject(PAYMENT_NOTIFIER)
		private readonly paymentNotifier: AdminNotifier,
	) {}

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
			// Lock 경합 → 429 반환 (RevenueCat 재시도 유도)
			// SUBSCRIPTION_1605는 httpStatus=429이므로 GlobalExceptionFilter가 그대로 처리
			if (
				error instanceof BusinessException &&
				error.errorCode === ErrorCode.SUBSCRIPTION_1605
			) {
				this.#logger.warn(`Lock contention, returning 429: ${error.message}`);
				throw error;
			}
			// 그 외 에러 → Sentry + Discord 알림 + 200 반환 (무한 재시도 방지)
			Sentry.withScope((scope) => {
				scope.setTag("domain", "payment");
				scope.setTag("webhook.event_type", parseResult.data.event.type);
				scope.setTag(
					"webhook.store",
					parseResult.data.event.store ?? "unknown",
				);
				scope.setExtra(
					"webhook.app_user_id",
					parseResult.data.event.app_user_id,
				);
				scope.setExtra("webhook.product_id", parseResult.data.event.product_id);
				scope.setExtra("webhook.event_id", parseResult.data.event.id);
				Sentry.captureException(error);
			});

			this.#logger.error(
				`Failed to process webhook event: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);

			this.#notifyWebhookError(error, parseResult.data).catch((e) =>
				this.#logger.warn(`Failed to send webhook error notification: ${e}`),
			);
		}

		return { received: true };
	}

	async #notifyWebhookError(
		error: unknown,
		payload: RevenueCatWebhookPayload,
	): Promise<void> {
		const errorMessage = error instanceof Error ? error.message : String(error);

		await this.paymentNotifier.send({
			title: "Webhook 처리 에러",
			body: "RevenueCat 웹훅 처리 중 에러가 발생했습니다.",
			color: 0xff0000,
			fields: [
				{
					name: "에러",
					value: errorMessage.slice(0, 1024),
					inline: false,
				},
				{
					name: "이벤트 타입",
					value: payload.event.type,
					inline: true,
				},
				{
					name: "사용자 ID",
					value: payload.event.app_user_id,
					inline: true,
				},
				{
					name: "상품",
					value: payload.event.product_id,
					inline: true,
				},
			],
		});
	}
}
