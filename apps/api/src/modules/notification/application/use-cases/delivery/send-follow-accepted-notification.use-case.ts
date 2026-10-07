import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/delivery/transactional-notification-campaign.js";
import { createFollowAcceptedNotificationMessage } from "../../messages/delivery/notification-messages.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationRecipientLocaleReader } from "../../readers/delivery/notification-recipient-locale.reader.js";

export interface SendFollowAcceptedNotificationInput {
  readonly userId: string;
  readonly friendId: string;
  readonly friendName: string;
}

interface SendFollowAcceptedNotificationDependencies {
  readonly notificationPublisher: NotificationPublisher;
  readonly recipientLocaleReader: NotificationRecipientLocaleReader;
  readonly logger: ApplicationLogger;
}

export class SendFollowAcceptedNotification {
  readonly #dependencies: SendFollowAcceptedNotificationDependencies;

  constructor(dependencies: SendFollowAcceptedNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendFollowAcceptedNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getRecipientLocale(input.userId);
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

    await this.#dependencies.notificationPublisher.publishWithDeduplication({
      userId: input.userId,
      type: "FOLLOW_ACCEPTED",
      title: message.title,
      body: message.body,
      friendId: input.friendId,
      campaignKey: variantContext.campaignKey,
      variantId: message.variantId,
    });
    this.#dependencies.logger.log(`Mutual follow notification sent to user: ${input.userId}`);
  }
}
