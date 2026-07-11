import { Injectable } from "@nestjs/common";

import { AdminNotificationQueueService } from "@/admin-notification/queue/admin-notification-queue.service";
import { NotificationQueueService } from "@/notification/queue";
import type { SubscriptionEventNotifierPort } from "../../application/ports/subscription-event-notifier.port";
import type { SubscriptionEventPayload } from "../../domain/events/subscription-event.payload";

/**
 * 구독 이벤트 알림 어댑터.
 *
 * 관리자 알림(Discord)은 admin-notification 큐로, 결제 이슈 푸시는 notification 큐로
 * fire-and-forget 위임한다. 트랜잭션 커밋 후 use-case가 호출한다.
 */
@Injectable()
export class SubscriptionEventNotifierAdapter
	implements SubscriptionEventNotifierPort
{
	constructor(
		private readonly adminNotificationQueueService: AdminNotificationQueueService,
		private readonly notificationQueueService: NotificationQueueService,
	) {}

	notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
		this.adminNotificationQueueService.enqueueSubscriptionEvent(payload);
	}

	notifyBillingIssue(userId: string): void {
		this.notificationQueueService.enqueueBillingIssue({ userId });
	}
}
