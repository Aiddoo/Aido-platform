import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/delivery/transactional-notification-campaign.js";
import { createFollowAcceptedNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import type { NotificationRecipientLocaleReaderPort } from "../../ports/delivery/notification-recipient-locale.reader.port.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";

export interface SendFollowAcceptedNotificationInput {
  readonly userId: string;
  readonly friendId: string;
  readonly friendName: string;
}

interface SendFollowAcceptedNotificationDependencies {
  readonly notificationPublisher: Pick<NotificationPublisher, "publishWithDeduplication">;
  readonly recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocale">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

export class SendFollowAcceptedNotification {
  readonly #dependencies: SendFollowAcceptedNotificationDependencies;

  constructor(dependencies: SendFollowAcceptedNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendFollowAcceptedNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getLocale(input.userId);
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
    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.SEND_FOLLOW_ACCEPTED_NOTIFICATION_SENT,
      userId: input.userId,
    });
  }
}
