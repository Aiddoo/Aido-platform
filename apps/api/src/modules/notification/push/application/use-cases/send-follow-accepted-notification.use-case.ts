import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/transactional-notification-campaign.constants.js";
import { createFollowAcceptedNotificationMessage } from "../messages/social-notification.messages.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type { NotificationRecipientLocaleReaderPort } from "../ports/notification-recipient-locale.reader.port.js";
import type { PublishNotificationUseCase } from "./publish-notification.use-case.js";

export interface SendFollowAcceptedNotificationInput {
  readonly userId: string;
  readonly friendId: string;
  readonly friendName: string;
}

interface SendFollowAcceptedNotificationDependencies {
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishWithDeduplication">;
  readonly recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocale">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendFollowAcceptedNotificationUseCase {
  readonly #dependencies: SendFollowAcceptedNotificationDependencies;

  constructor(dependencies: SendFollowAcceptedNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendFollowAcceptedNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getLocale(
      UserId.reconstitute(input.userId),
    );
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
      copyKey: message.copyKey,
      copyFacts: message.copyFacts,
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
