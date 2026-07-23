import type { RevenueCatWebhookPayload } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import {
	AdminNotificationFacade,
	type AdminNotifier,
	PAYMENT_NOTIFIER,
} from "@/admin-notification";
import { NotificationQueueService } from "@/notification";
import type { SubscriptionEventNotifierPort } from "../../application/ports/subscription-event-notifier.port";
import type { SubscriptionEventPayload } from "../../application/types/subscription-event.payload";

/**
 * 구독 이벤트 알림 어댑터.
 *
 * 관리자 알림(Discord)은 admin-notification 큐로, 결제 이슈 푸시는 notification 큐로
 * fire-and-forget 위임한다. 트랜잭션 커밋 후 use-case가 호출한다.
 * 웹훅 처리 실패는 Sentry(에러 관측)·Discord(관리자 알림)로 보고한다 — 벤더 SDK는
 * infrastructure에 격리한다.
 */
@Injectable()
export class SubscriptionEventNotifierAdapter
	implements SubscriptionEventNotifierPort
{
	readonly #logger = new Logger(SubscriptionEventNotifierAdapter.name);

	constructor(
		private readonly adminNotificationFacade: AdminNotificationFacade,
		private readonly notificationQueueService: NotificationQueueService,
		@Inject(PAYMENT_NOTIFIER)
		private readonly paymentNotifier: AdminNotifier,
	) {}

	notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
		this.adminNotificationFacade.notifySubscriptionEvent(payload);
	}

	notifyBillingIssue(userId: string): void {
		this.notificationQueueService.enqueueBillingIssue({ userId });
	}

	reportWebhookFailure(
		error: unknown,
		payload: RevenueCatWebhookPayload,
	): void {
		// 1. Sentry 태깅 캡처 (결제 도메인 컨텍스트)
		Sentry.withScope((scope) => {
			scope.setTag("domain", "payment");
			scope.setTag("webhook.event_type", payload.event.type);
			scope.setTag("webhook.store", payload.event.store ?? "unknown");
			scope.setExtra("webhook.app_user_id", payload.event.app_user_id);
			scope.setExtra("webhook.product_id", payload.event.product_id);
			scope.setExtra("webhook.event_id", payload.event.id);
			Sentry.captureException(error);
		});

		// 2. Discord 관리자 알림 (fire-and-forget)
		this.#notifyWebhookError(error, payload).catch((e) =>
			this.#logger.warn(`Failed to send webhook error notification: ${e}`),
		);
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
