import { Injectable } from "@nestjs/common";

import { NotificationQueueService } from "@/notification";

import type {
	CheerNotifierPort,
	CheerSentNotification,
} from "../../application/ports/cheer-notifier.port";

/**
 * CheerNotifierPort의 어댑터 — 레거시 NotificationQueueService(BullMQ)에 위임한다.
 */
@Injectable()
export class CheerNotifierAdapter implements CheerNotifierPort {
	constructor(private readonly queue: NotificationQueueService) {}

	notifyCheerSent(payload: CheerSentNotification): void {
		this.queue.enqueueCheerSent(payload);
	}
}
