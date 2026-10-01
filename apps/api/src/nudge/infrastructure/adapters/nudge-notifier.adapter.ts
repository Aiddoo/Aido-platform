import { Injectable } from "@nestjs/common";

import { NotificationQueueService } from "#api/notification/queue";

import type {
	NudgeNotifierPort,
	NudgeSentNotification,
} from "../../application/ports/nudge-notifier.port.js";

/**
 * NudgeNotifierPort의 어댑터 — 레거시 NotificationQueueService(BullMQ)에 위임한다.
 */
@Injectable()
export class NudgeNotifierAdapter implements NudgeNotifierPort {
	constructor(private readonly queue: NotificationQueueService) {}

	notifyNudgeSent(payload: NudgeSentNotification): void {
		this.queue.enqueueNudgeSent(payload);
	}
}
