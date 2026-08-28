import { Injectable, Logger } from "@nestjs/common";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign";
import { createCheerReceivedNotificationMessage } from "../../messages/notification-messages";
import { NotificationPublisher } from "../../publishers/notification.publisher";
import { NotificationRecipientLocaleReader } from "../../readers/notification-recipient-locale.reader";

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

	constructor(
		private readonly notificationPublisher: NotificationPublisher,
		private readonly recipientLocaleReader: NotificationRecipientLocaleReader,
	) {}

	async execute(input: SendCheerNotificationInput): Promise<void> {
		const locale = await this.recipientLocaleReader.getRecipientLocale(input.receiverId);
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

		await this.notificationPublisher.publishWithDeduplication({
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
