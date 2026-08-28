import { Injectable, Logger } from "@nestjs/common";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/transactional-notification-campaign";
import { createFollowRequestNotificationMessage } from "../../messages/notification-messages";
import { NotificationPublisher } from "../../publishers/notification.publisher";
import { NotificationRecipientLocaleReader } from "../../readers/notification-recipient-locale.reader";

export interface SendFollowRequestNotificationInput {
	readonly followerId: string;
	readonly followingId: string;
	readonly followerName: string;
}

@Injectable()
export class SendFollowRequestNotificationUseCase {
	readonly #logger = new Logger(SendFollowRequestNotificationUseCase.name);

	constructor(
		private readonly notificationPublisher: NotificationPublisher,
		private readonly recipientLocaleReader: NotificationRecipientLocaleReader,
	) {}

	async execute(input: SendFollowRequestNotificationInput): Promise<void> {
		const locale = await this.recipientLocaleReader.getRecipientLocale(input.followingId);
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

		await this.notificationPublisher.publishWithDeduplication({
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
