import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/delivery/transactional-notification-campaign.js";
import { createFollowRequestNotificationMessage } from "../../messages/delivery/notification-messages.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationRecipientLocaleReader } from "../../readers/delivery/notification-recipient-locale.reader.js";

export interface SendFollowRequestNotificationInput {
  readonly followerId: string;
  readonly followingId: string;
  readonly followerName: string;
}

interface SendFollowRequestNotificationDependencies {
  readonly notificationPublisher: NotificationPublisher;
  readonly recipientLocaleReader: NotificationRecipientLocaleReader;
  readonly logger: ApplicationLogger;
}

export class SendFollowRequestNotification {
  readonly #dependencies: SendFollowRequestNotificationDependencies;

  constructor(dependencies: SendFollowRequestNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendFollowRequestNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getRecipientLocale(
      input.followingId,
    );
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

    await this.#dependencies.notificationPublisher.publishWithDeduplication({
      userId: input.followingId,
      type: "FOLLOW_NEW",
      title: message.title,
      body: message.body,
      friendId: input.followerId,
      campaignKey: variantContext.campaignKey,
      variantId: message.variantId,
    });
    this.#dependencies.logger.log(`Follow request notification sent to user: ${input.followingId}`);
  }
}
