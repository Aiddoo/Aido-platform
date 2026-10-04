import { Injectable } from "@nestjs/common";
import { match } from "ts-pattern";

import {
	createNudgeReplyNotificationMessage,
	createNudgeThanksNotificationMessage,
	NotificationPublisher,
	NotificationRecipientLocaleReader,
	TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY,
} from "#api/notification/index";
import { NotificationQueueService } from "#api/notification/queue";

import type {
	NudgeNotifierPort,
	NudgeSentNotification,
	NudgeInteractionNotification,
} from "../../application/ports/nudge-notifier.port.js";

@Injectable()
export class NudgeNotifierAdapter implements NudgeNotifierPort {
	constructor(
		private readonly notificationQueue: NotificationQueueService,
		private readonly notificationPublisher: NotificationPublisher,
		private readonly notificationRecipientLocaleReader: NotificationRecipientLocaleReader,
	) {}

	notifyNudgeSent(payload: NudgeSentNotification): void {
		this.notificationQueue.enqueueNudgeSent(payload);
	}

	async recordInteraction(payload: NudgeInteractionNotification): Promise<void> {
		const locale = await this.notificationRecipientLocaleReader.getRecipientLocale(
			payload.recipientId,
		);
		const type = payload.kind === "reply" ? "NUDGE_REPLIED" : "NUDGE_THANKED";
		const campaignKey = TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY[type];
		const copyInput = {
			senderName: payload.actorName,
			todoTitle: payload.todoTitle,
			locale,
			variantContext: {
				campaignKey,
				recipientId: payload.recipientId,
				occurrenceKey: String(payload.nudgeId),
			},
		};
		const message = match(payload)
			.with({ kind: "reply" }, (reply) =>
				createNudgeReplyNotificationMessage({ ...copyInput, replyKind: reply.replyKind }),
			)
			.with({ kind: "thanks" }, () => createNudgeThanksNotificationMessage(copyInput))
			.exhaustive();
		// 호출자의 UoW에 참여해 상태·알림·push outbox를 같은 커밋 경계에 저장한다.
		await this.notificationPublisher.publish({
			userId: payload.recipientId,
			type,
			title: message.title,
			body: message.body,
			nudgeId: payload.nudgeId,
			todoId: payload.todoId,
			friendId: payload.actorId,
			campaignKey,
			variantId: message.variantId,
		});
	}
}
