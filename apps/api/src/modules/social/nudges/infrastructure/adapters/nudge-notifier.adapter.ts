import { Inject, Injectable } from "@nestjs/common";
import { match } from "ts-pattern";

import { NotificationQueueAdapter } from "#api/modules/notification/notification-delivery-jobs.public";
import {
  createNudgeReplyNotificationMessage,
  createNudgeThanksNotificationMessage,
  PublishNotificationUseCase,
  type CreateNotificationData,
  NotificationRecipientLocaleReaderPort,
  TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY,
} from "#api/modules/notification/notification-delivery.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { DEFAULT_LOCALE, type SupportedLocale } from "#api/shared/domain/locale";

import {
  type NudgeInteractionNotification,
  NudgeNotifierPort,
  type NudgeSentNotification,
} from "../../application/ports/nudge-notifier.port.js";

@Injectable()
export class NudgeNotifierAdapter extends NudgeNotifierPort {
  readonly #notificationQueue: NotificationQueueAdapter;
  readonly #notificationPublisher: PublishNotificationUseCase;
  readonly #notificationRecipientLocaleReader: NotificationRecipientLocaleReaderPort;

  constructor(
    notificationQueue: NotificationQueueAdapter,
    notificationPublisher: PublishNotificationUseCase,
    @Inject(NotificationRecipientLocaleReaderPort)
    notificationRecipientLocaleReader: NotificationRecipientLocaleReaderPort,
  ) {
    super();
    this.#notificationQueue = notificationQueue;
    this.#notificationPublisher = notificationPublisher;
    this.#notificationRecipientLocaleReader = notificationRecipientLocaleReader;
  }

  notifyNudgeSent(notification: NudgeSentNotification): void {
    this.#notificationQueue.enqueueNudgeSent(notification);
  }

  async recordInteraction(notification: NudgeInteractionNotification): Promise<void> {
    const locale = await this.#notificationRecipientLocaleReader.getLocale(
      UserId.reconstitute(notification.recipientId),
    );
    await this.#notificationPublisher.publish(this.#toNotificationData(notification, locale));
  }

  async recordInteractions(notifications: readonly NudgeInteractionNotification[]): Promise<void> {
    if (notifications.length === 0) {
      return;
    }
    const locales = await this.#notificationRecipientLocaleReader.getLocales(
      notifications.map((notification) => UserId.reconstitute(notification.recipientId)),
    );
    await this.#notificationPublisher.publishBatch(
      notifications.map((notification) =>
        this.#toNotificationData(
          notification,
          locales.get(notification.recipientId) ?? DEFAULT_LOCALE,
        ),
      ),
    );
  }

  #toNotificationData(
    payload: NudgeInteractionNotification,
    locale: SupportedLocale,
  ): CreateNotificationData {
    const type = payload.kind === "reply" ? "NUDGE_REPLIED" : "NUDGE_THANKED";
    const campaignKey = TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY[type];
    const copyInput = {
      senderName: payload.actorName,
      todoTitle: payload.todoTitle,
      locale,
      variantContext: {
        campaignKey,
        recipientId: payload.recipientId,
        occurrenceKey: String(payload.nudgeId),
      },
    };
    const message = match(payload)
      .with({ kind: "reply" }, (reply) =>
        createNudgeReplyNotificationMessage({ ...copyInput, replyKind: reply.replyKind }),
      )
      .with({ kind: "thanks" }, () => createNudgeThanksNotificationMessage(copyInput))
      .exhaustive();
    return {
      userId: payload.recipientId,
      type,
      title: message.title,
      body: message.body,
      nudgeId: payload.nudgeId,
      todoId: payload.todoId,
      friendId: payload.actorId,
      campaignKey,
      variantId: message.variantId,
    };
  }
}
