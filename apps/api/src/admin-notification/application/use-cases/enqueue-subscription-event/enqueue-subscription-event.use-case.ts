import { Inject, Injectable } from "@nestjs/common";

import type { SubscriptionEventPayload } from "@/subscription";

import { buildSubscriptionEventMessage } from "../../../domain/services/admin-message.factory";
import {
	ADMIN_NOTIFICATION_QUEUE_PORT,
	type AdminNotificationQueuePort,
} from "../../ports/admin-notification-queue.port";

/**
 * 구독 이벤트 관리자 알림 등록 유스케이스.
 *
 * RevenueCat 구독 이벤트를 결제 채널 Discord 알림 SEND 잡으로 큐에 등록한다.
 */
@Injectable()
export class EnqueueSubscriptionEventUseCase {
	constructor(
		@Inject(ADMIN_NOTIFICATION_QUEUE_PORT)
		private readonly queue: AdminNotificationQueuePort,
	) {}

	async execute(payload: SubscriptionEventPayload): Promise<void> {
		const message = buildSubscriptionEventMessage(payload);
		await this.queue.enqueueSend("payment", message.toPayload());
	}
}
