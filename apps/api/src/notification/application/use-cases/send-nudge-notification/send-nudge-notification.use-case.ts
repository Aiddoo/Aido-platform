import { Injectable, Logger } from "@nestjs/common";

import {
	createNudgeReceivedNotificationMessage,
	createTodoCreationNudgeNotificationMessage,
} from "../../../domain/services/templates/notification-templates";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign";
import { NotificationSender } from "../../senders/notification.sender";

export interface SendNudgeNotificationInput {
	readonly nudgeId: number;
	readonly senderId: string;
	readonly receiverId: string;
	readonly senderName: string;
	readonly todoId?: number;
	readonly todoTitle?: string;
	readonly message?: string;
}

@Injectable()
export class SendNudgeNotificationUseCase {
	readonly #logger = new Logger(SendNudgeNotificationUseCase.name);

	constructor(private readonly notificationSender: NotificationSender) {}

	async execute(input: SendNudgeNotificationInput): Promise<void> {
		const locale = await this.notificationSender.getUserLocale(input.receiverId);
		const variantContext = {
			campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.NUDGE_RECEIVED,
			recipientId: input.receiverId,
			occurrenceKey: String(input.nudgeId),
		};
		const message = input.todoId
			? createNudgeReceivedNotificationMessage({
					senderName: input.senderName,
					todoTitle: input.todoTitle,
					message: input.message,
					locale,
					variantContext,
				})
			: createTodoCreationNudgeNotificationMessage({
					senderName: input.senderName,
					message: input.message,
					locale,
					variantContext,
				});

		await this.notificationSender.createAndSendWithDedup({
			userId: input.receiverId,
			type: "NUDGE_RECEIVED",
			title: message.title,
			body: message.body,
			nudgeId: input.nudgeId,
			friendId: input.senderId,
			todoId: input.todoId,
			metadata: input.message ? { message: input.message } : undefined,
			campaignKey: variantContext.campaignKey,
			variantId: message.variantId,
		});
		this.#logger.log(`Nudge notification sent: from=${input.senderId}, to=${input.receiverId}`);
	}
}
