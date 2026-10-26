import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/delivery/transactional-notification-campaign.js";
import { createCheerReceivedNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import type { NotificationRecipientLocaleReaderPort } from "../../ports/delivery/notification-recipient-locale.reader.port.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";

export interface SendCheerNotificationInput {
  readonly cheerId: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly senderName: string;
  readonly message?: string;
}

interface SendCheerNotificationDependencies {
  readonly notificationPublisher: Pick<NotificationPublisher, "publishWithDeduplication">;
  readonly recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocale">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

export class SendCheerNotification {
  readonly #dependencies: SendCheerNotificationDependencies;

  constructor(dependencies: SendCheerNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendCheerNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getLocale(input.receiverId);
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
      // 보낸 사람은 받은 사람이 응원을 신고·차단할 때 확인 문구에 이름을 보여 주는 데 쓴다
      metadata: {
        senderId: input.senderId,
        senderName: input.senderName,
        ...(input.message ? { message: input.message } : {}),
      },
      campaignKey: variantContext.campaignKey,
      variantId: message.variantId,
    });
    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.SEND_CHEER_NOTIFICATION_SENT,
      userId: input.receiverId,
    });
  }
}
