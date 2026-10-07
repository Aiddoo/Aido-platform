import { Injectable } from "@nestjs/common";
import { match } from "ts-pattern";

import {
  createNudgeReplyNotificationMessage,
  createNudgeThanksNotificationMessage,
  NotificationPublisher,
  type CreateNotificationData,
  NotificationRecipientLocaleReader,
  TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY,
} from "#api/notification/index";
import { NotificationQueueService } from "#api/notification/queue";
import { DEFAULT_LOCALE, type SupportedLocale } from "#api/shared/domain/locale";

import type {
  NudgeNotifierPort,
  NudgeSentNotification,
  NudgeInteractionNotification,
} from "../../application/ports/nudge-notifier.port.js";

@Injectable()
export class NudgeNotifierAdapter implements NudgeNotifierPort {
  constructor(
    private readonly notificationQueue: NotificationQueueService,
    private readonly notificationPublisher: NotificationPublisher,
    private readonly notificationRecipientLocaleReader: NotificationRecipientLocaleReader,
  ) {}

  notifyNudgeSent(payload: NudgeSentNotification): void {
    this.notificationQueue.enqueueNudgeSent(payload);
  }

  async recordInteraction(payload: NudgeInteractionNotification): Promise<void> {
    const locale = await this.notificationRecipientLocaleReader.getRecipientLocale(
      payload.recipientId,
    );
    await this.notificationPublisher.publish(this.#toNotificationData(payload, locale));
  }

  async recordInteractions(payloads: readonly NudgeInteractionNotification[]): Promise<void> {
    if (payloads.length === 0) return;
    const locales = await this.notificationRecipientLocaleReader.getRecipientLocales(
      payloads.map((payload) => payload.recipientId),
    );
    await this.notificationPublisher.publishBatch(
      payloads.map((payload) =>
        this.#toNotificationData(payload, locales.get(payload.recipientId) ?? DEFAULT_LOCALE),
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
