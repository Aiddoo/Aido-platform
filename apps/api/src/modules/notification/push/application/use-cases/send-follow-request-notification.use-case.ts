import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/transactional-notification-campaign.constants.js";
import { createFollowRequestNotificationMessage } from "../messages/social-notification.messages.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type { NotificationRecipientLocaleReaderPort } from "../ports/notification-recipient-locale.reader.port.js";
import type { PublishNotificationUseCase } from "./publish-notification.use-case.js";

export interface SendFollowRequestNotificationInput {
  readonly followerId: string;
  readonly followingId: string;
  readonly followerName: string;
}

interface SendFollowRequestNotificationDependencies {
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishWithDeduplication">;
  readonly recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocale">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendFollowRequestNotificationUseCase {
  readonly #dependencies: SendFollowRequestNotificationDependencies;

  constructor(dependencies: SendFollowRequestNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendFollowRequestNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getLocale(
      UserId.reconstitute(input.followingId),
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
      copyKey: message.copyKey,
      copyFacts: message.copyFacts,
      friendId: input.followerId,
      campaignKey: variantContext.campaignKey,
      variantId: message.variantId,
    });
    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.SEND_FOLLOW_REQUEST_NOTIFICATION_SENT,
      userId: input.followingId,
    });
  }
}
