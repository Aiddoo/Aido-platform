import { Injectable, Logger } from "@nestjs/common";

import { createFollowRequestNotificationMessage } from "../../../domain/services/templates/notification-templates";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign";
import { NotificationSender } from "../../senders/notification.sender";

export interface SendFollowRequestNotificationInput {
	readonly followerId: string;
	readonly followingId: string;
	readonly followerName: string;
}

@Injectable()
export class SendFollowRequestNotificationUseCase {
	readonly #logger = new Logger(SendFollowRequestNotificationUseCase.name);

	constructor(private readonly notificationSender: NotificationSender) {}

	async execute(input: SendFollowRequestNotificationInput): Promise<void> {
		const locale = await this.notificationSender.getUserLocale(input.followingId);
		const variantContext = {
			campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FOLLOW_REQUEST,
			recipientId: input.followingId,
			occurrenceKey: `${input.followerId}:${input.followingId}`,
		};
		const message = createFollowRequestNotificationMessage({
			senderName: input.followerName,
			locale,
			variantContext,
		});

		await this.notificationSender.createAndSendWithDedup({
			userId: input.followingId,
			type: "FOLLOW_NEW",
			title: message.title,
			body: message.body,
			friendId: input.followerId,
			campaignKey: variantContext.campaignKey,
			variantId: message.variantId,
		});
		this.#logger.log(`Follow request notification sent to user: ${input.followingId}`);
	}
}
