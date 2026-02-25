import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import {
	type SubscriptionEventPayload,
	SubscriptionEvents,
} from "../events/subscription.events";

/**
 * 구독 결제 문제 리스너
 *
 * BILLING_ISSUE 이벤트 수신 시 해당 사용자에게 푸시 알림을 발송합니다.
 * 관리자 알림은 SubscriptionNotificationListener가 처리합니다.
 */
@Injectable()
export class SubscriptionBillingIssueListener {
	readonly #logger = new Logger(SubscriptionBillingIssueListener.name);

	constructor(private readonly notificationService: NotificationService) {}

	@OnEvent(SubscriptionEvents.BILLING_ISSUE)
	async handleBillingIssue(payload: SubscriptionEventPayload): Promise<void> {
		this.#logger.debug(
			`Handling subscription.billing_issue event: userId=${payload.userId}`,
		);

		try {
			const message = NotificationMessageBuilder.billingIssue();

			await this.notificationService.createAndSend({
				userId: payload.userId,
				type: "SYSTEM_NOTICE",
				title: message.title,
				body: message.body,
			});

			this.#logger.log(
				`Billing issue notification sent: userId=${payload.userId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send billing issue notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
