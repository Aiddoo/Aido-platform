import { Inject, Injectable } from "@nestjs/common";

import {
  createInviteJoinedNotificationMessage,
  NotificationPublisher,
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  type NotificationRecipientLocaleReaderPort,
  TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY,
} from "#api/modules/notification/notification-delivery.public";

import type {
  InviteJoinedNotification,
  InviteNotifierPort,
} from "../../../application/ports/invites/invite-notifier.port.js";

@Injectable()
export class InviteNotifierAdapter implements InviteNotifierPort {
  constructor(
    private readonly notificationPublisher: NotificationPublisher,
    @Inject(NOTIFICATION_RECIPIENT_LOCALE_READER)
    private readonly localeReader: NotificationRecipientLocaleReaderPort,
  ) {}

  async notifyInviteJoined(notification: InviteJoinedNotification): Promise<void> {
    const campaignKey = TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.INVITE_JOINED;
    const message = createInviteJoinedNotificationMessage({
      inviteeName: notification.inviteeName,
      locale: await this.localeReader.getLocale(notification.inviterId),
      variantContext: {
        campaignKey,
        recipientId: notification.inviterId,
        occurrenceKey: notification.redemptionId,
      },
    });
    await this.notificationPublisher.publish({
      userId: notification.inviterId,
      type: "INVITE_JOINED",
      title: message.title,
      body: message.body,
      metadata: { redemptionId: notification.redemptionId },
      campaignKey,
      variantId: message.variantId,
    });
  }
}
