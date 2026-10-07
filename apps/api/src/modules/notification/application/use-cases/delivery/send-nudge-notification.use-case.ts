import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/delivery/transactional-notification-campaign.js";
import {
  createNudgeReceivedNotificationMessage,
  createTodoCreationNudgeNotificationMessage,
} from "../../messages/delivery/notification-messages.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationRecipientLocaleReader } from "../../readers/delivery/notification-recipient-locale.reader.js";

export interface SendNudgeNotificationInput {
  readonly nudgeId: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly senderName: string;
  readonly todoId?: number;
  readonly todoTitle?: string;
  readonly message?: string;
}

interface SendNudgeNotificationDependencies {
  readonly notificationPublisher: NotificationPublisher;
  readonly recipientLocaleReader: NotificationRecipientLocaleReader;
  readonly logger: ApplicationLogger;
}

export class SendNudgeNotification {
  readonly #dependencies: SendNudgeNotificationDependencies;

  constructor(dependencies: SendNudgeNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendNudgeNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getRecipientLocale(
      input.receiverId,
    );
    const variantContext = {
      campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.NUDGE_RECEIVED,
      recipientId: input.receiverId,
      occurrenceKey: String(input.nudgeId),
    };
    const message = input.todoId
      ? createNudgeReceivedNotificationMessage({
          senderName: input.senderName,
          todoTitle: input.todoTitle,
          message: input.message,
          locale,
          variantContext,
        })
      : createTodoCreationNudgeNotificationMessage({
          senderName: input.senderName,
          message: input.message,
          locale,
          variantContext,
        });

    await this.#dependencies.notificationPublisher.publishWithDeduplication({
      userId: input.receiverId,
      type: "NUDGE_RECEIVED",
      title: message.title,
      body: message.body,
      nudgeId: input.nudgeId,
      friendId: input.senderId,
      todoId: input.todoId,
      metadata: input.message ? { message: input.message } : undefined,
      campaignKey: variantContext.campaignKey,
      variantId: message.variantId,
    });
    this.#dependencies.logger.log(
      `Nudge notification sent: from=${input.senderId}, to=${input.receiverId}`,
    );
  }
}
