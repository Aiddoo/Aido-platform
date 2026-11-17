import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationRecipientLocaleReaderPort } from "../../../push-dispatches/notification-push-dispatches.public.js";
import { createFollowRequestNotificationMessage } from "../../../shared/application/messages/social-notification.messages.js";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../shared/domain/transactional-notification-campaign.constants.js";
import { NotificationLogEvent } from "../notifications.log-events.js";
import type { PublishDeduplicatedNotificationUseCase } from "./publish-deduplicated-notification.use-case.js";

export interface SendFollowRequestNotificationInput {
  readonly followerId: string;
  readonly followingId: string;
  readonly followerName: string;
}

interface SendFollowRequestNotificationDependencies {
  readonly notificationPublisher: Pick<PublishDeduplicatedNotificationUseCase, "execute">;
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

    await this.#dependencies.notificationPublisher.execute({
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
      event: NotificationLogEvent.SEND_FOLLOW_REQUEST_NOTIFICATION_SENT,
      userId: input.followingId,
    });
  }
}
