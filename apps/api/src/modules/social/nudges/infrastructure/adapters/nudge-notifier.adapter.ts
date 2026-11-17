import { Inject, Injectable } from "@nestjs/common";
import { match } from "ts-pattern";

import { NotificationQueueAdapter } from "#api/modules/notification/notifications/notification-notifications-jobs.public";
import {
  type CreateNotificationData,
  createNudgeReplyNotificationMessage,
  createNudgeThanksNotificationMessage,
  PublishNotificationBatchUseCase,
  PublishNotificationUseCase,
  TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY,
} from "#api/modules/notification/notifications/notification-notifications.public";
import { NotificationRecipientLocaleReaderPort } from "#api/modules/notification/push-dispatches/notification-push-dispatches.public";
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
  readonly #notificationBatchPublisher: PublishNotificationBatchUseCase;
  readonly #notificationRecipientLocaleReader: NotificationRecipientLocaleReaderPort;

  constructor(
    notificationQueue: NotificationQueueAdapter,
    notificationPublisher: PublishNotificationUseCase,
    notificationBatchPublisher: PublishNotificationBatchUseCase,
    @Inject(NotificationRecipientLocaleReaderPort)
    notificationRecipientLocaleReader: NotificationRecipientLocaleReaderPort,
  ) {
    super();
    this.#notificationQueue = notificationQueue;
    this.#notificationPublisher = notificationPublisher;
    this.#notificationBatchPublisher = notificationBatchPublisher;
    this.#notificationRecipientLocaleReader = notificationRecipientLocaleReader;
  }

  notifyNudgeSent(notification: NudgeSentNotification): Promise<void> {
    return this.#notificationQueue.enqueueNudgeSent({
      nudgeId: notification.nudgeId.value,
      senderId: notification.senderId.value,
      receiverId: notification.receiverId.value,
      senderName: notification.senderName,
      todoId: notification.todoId.value,
      todoTitle: notification.todoTitle,
      message: notification.message,
    });
  }

  async recordInteraction(notification: NudgeInteractionNotification): Promise<void> {
    const locale = await this.#notificationRecipientLocaleReader.getLocale(
      notification.recipientId,
    );
    await this.#notificationPublisher.execute(this.#toNotificationData(notification, locale));
  }

  async recordInteractions(notifications: readonly NudgeInteractionNotification[]): Promise<void> {
    if (notifications.length === 0) {
      return;
    }
    const locales = await this.#notificationRecipientLocaleReader.getLocales(
      notifications.map((notification) => notification.recipientId),
    );
    await this.#notificationBatchPublisher.execute(
      notifications.map((notification) =>
        this.#toNotificationData(
          notification,
          locales.get(notification.recipientId.value) ?? DEFAULT_LOCALE,
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
        recipientId: payload.recipientId.value,
        occurrenceKey: String(payload.nudgeId.value),
      },
    };
    const message = match(payload)
      .with({ kind: "reply" }, (reply) =>
        createNudgeReplyNotificationMessage({ ...copyInput, replyKind: reply.replyKind }),
      )
      .with({ kind: "thanks" }, () => createNudgeThanksNotificationMessage(copyInput))
      .exhaustive();
    return {
      userId: payload.recipientId.value,
      type,
      title: message.title,
      body: message.body,
      nudgeId: payload.nudgeId.value,
      todoId: payload.todoId.value,
      friendId: payload.actorId.value,
      campaignKey,
      variantId: message.variantId,
    };
  }
}
