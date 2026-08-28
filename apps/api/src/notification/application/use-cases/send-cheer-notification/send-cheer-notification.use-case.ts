import { Injectable, Logger } from "@nestjs/common";

import { createCheerReceivedNotificationMessage } from "../../../domain/services/templates/notification-templates";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign";
import { NotificationSender } from "../../senders/notification.sender";

export interface SendCheerNotificationInput {
	readonly cheerId: number;
	readonly senderId: string;
	readonly receiverId: string;
	readonly senderName: string;
	readonly message?: string;
}

@Injectable()
export class SendCheerNotificationUseCase {
	readonly #logger = new Logger(SendCheerNotificationUseCase.name);

	constructor(private readonly notificationSender: NotificationSender) {}

	async execute(input: SendCheerNotificationInput): Promise<void> {
		const locale = await this.notificationSender.getUserLocale(input.receiverId);
		const variantContext = {
			campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.CHEER_RECEIVED,
			recipientId: input.receiverId,
			occurrenceKey: String(input.cheerId),
		};
		const message = createCheerReceivedNotificationMessage({
			senderName: input.senderName,
			message: input.message,
			locale,
			variantContext,
		});

		await this.notificationSender.createAndSendWithDedup({
			userId: input.receiverId,
			type: "CHEER_RECEIVED",
			title: message.title,
			body: message.body,
			cheerId: input.cheerId,
			friendId: input.senderId,
			metadata: input.message ? { message: input.message } : undefined,
			campaignKey: variantContext.campaignKey,
			variantId: message.variantId,
		});
		this.#logger.log(`Cheer notification sent: from=${input.senderId}, to=${input.receiverId}`);
	}
}
