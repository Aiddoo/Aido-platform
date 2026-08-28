import { Injectable, Logger } from "@nestjs/common";

import { createFollowAcceptedNotificationMessage } from "../../../domain/services/templates/notification-templates";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign";
import { NotificationSender } from "../../senders/notification.sender";

export interface SendFollowAcceptedNotificationInput {
	readonly userId: string;
	readonly friendId: string;
	readonly friendName: string;
}

@Injectable()
export class SendFollowAcceptedNotificationUseCase {
	readonly #logger = new Logger(SendFollowAcceptedNotificationUseCase.name);

	constructor(private readonly notificationSender: NotificationSender) {}

	async execute(input: SendFollowAcceptedNotificationInput): Promise<void> {
		const locale = await this.notificationSender.getUserLocale(input.userId);
		const variantContext = {
			campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FOLLOW_ACCEPTED,
			recipientId: input.userId,
			occurrenceKey: `${input.friendId}:${input.userId}`,
		};
		const message = createFollowAcceptedNotificationMessage({
			senderName: input.friendName,
			locale,
			variantContext,
		});

		await this.notificationSender.createAndSendWithDedup({
			userId: input.userId,
			type: "FOLLOW_ACCEPTED",
			title: message.title,
			body: message.body,
			friendId: input.friendId,
			campaignKey: variantContext.campaignKey,
			variantId: message.variantId,
		});
		this.#logger.log(`Mutual follow notification sent to user: ${input.userId}`);
	}
}
