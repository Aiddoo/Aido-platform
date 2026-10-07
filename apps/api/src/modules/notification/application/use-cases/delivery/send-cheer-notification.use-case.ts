import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/delivery/transactional-notification-campaign.js";
import { createCheerReceivedNotificationMessage } from "../../messages/delivery/notification-messages.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationRecipientLocaleReader } from "../../readers/delivery/notification-recipient-locale.reader.js";

export interface SendCheerNotificationInput {
  readonly cheerId: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly senderName: string;
  readonly message?: string;
}

interface SendCheerNotificationDependencies {
  readonly notificationPublisher: NotificationPublisher;
  readonly recipientLocaleReader: NotificationRecipientLocaleReader;
  readonly logger: ApplicationLogger;
}

export class SendCheerNotification {
  readonly #dependencies: SendCheerNotificationDependencies;

  constructor(dependencies: SendCheerNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendCheerNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getRecipientLocale(
      input.receiverId,
    );
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

    await this.#dependencies.notificationPublisher.publishWithDeduplication({
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
    this.#dependencies.logger.log(
      `Cheer notification sent: from=${input.senderId}, to=${input.receiverId}`,
    );
  }
}
