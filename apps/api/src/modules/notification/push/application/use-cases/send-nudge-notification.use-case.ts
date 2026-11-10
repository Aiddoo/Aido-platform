import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/transactional-notification-campaign.constants.js";
import {
  createNudgeReceivedNotificationMessage,
  createTodoCreationNudgeNotificationMessage,
} from "../messages/notification.messages.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type { NotificationRecipientLocaleReaderPort } from "../ports/notification-recipient-locale.reader.port.js";
import type { PublishNotificationUseCase } from "./publish-notification.use-case.js";

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
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishWithDeduplication">;
  readonly recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocale">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendNudgeNotificationUseCase {
  readonly #dependencies: SendNudgeNotificationDependencies;

  constructor(dependencies: SendNudgeNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendNudgeNotificationInput): Promise<void> {
    const locale = await this.#dependencies.recipientLocaleReader.getLocale(
      UserId.reconstitute(input.receiverId),
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
      copyKey: message.copyKey,
      copyFacts: message.copyFacts,
      nudgeId: input.nudgeId,
      friendId: input.senderId,
      todoId: input.todoId,
      metadata: input.message ? { message: input.message } : undefined,
      campaignKey: variantContext.campaignKey,
      variantId: message.variantId,
    });
    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.SEND_NUDGE_NOTIFICATION_SENT,
      userId: input.receiverId,
    });
  }
}
