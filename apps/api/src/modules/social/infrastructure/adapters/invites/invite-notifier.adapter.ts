import { Inject, Injectable } from "@nestjs/common";

import {
  createInviteJoinedNotificationMessage,
  createInviteProgressNotificationMessage,
  createInviteQualifyReminderNotificationMessage,
  createInviteRewardedNotificationMessage,
  NotificationPublisher,
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  type NotificationRecipientLocaleReaderPort,
  PUSH_QUIET_HOURS_READER,
  type PushQuietHoursReaderPort,
  TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY,
} from "#api/modules/notification/notification-delivery.public";

import type {
  InviteJoinedNotification,
  InviteNotifierPort,
  InviteProgressNotification,
  InviteQualifyReminderNotification,
  InviteRewardedNotification,
} from "../../../application/ports/invites/invite-notifier.port.js";

@Injectable()
export class InviteNotifierAdapter implements InviteNotifierPort {
  constructor(
    private readonly notificationPublisher: NotificationPublisher,
    @Inject(NOTIFICATION_RECIPIENT_LOCALE_READER)
    private readonly localeReader: NotificationRecipientLocaleReaderPort,
    @Inject(PUSH_QUIET_HOURS_READER)
    private readonly quietHoursReader: PushQuietHoursReaderPort,
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

  async notifyInviteRewarded(notification: InviteRewardedNotification): Promise<void> {
    const campaignKey = TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.INVITE_REWARDED;
    const message = createInviteRewardedNotificationMessage({
      premiumDays: notification.premiumDays,
      friendSlots: notification.friendSlots,
      locale: await this.localeReader.getLocale(notification.recipientId),
      variantContext: {
        campaignKey,
        recipientId: notification.recipientId,
        occurrenceKey: notification.redemptionId,
      },
    });
    await this.notificationPublisher.publish({
      userId: notification.recipientId,
      type: "INVITE_REWARDED",
      title: message.title,
      body: message.body,
      metadata: { redemptionId: notification.redemptionId },
      campaignKey,
      variantId: message.variantId,
    });
  }

  async notifyInviteProgress(notification: InviteProgressNotification): Promise<void> {
    const campaignKey = TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.INVITE_PROGRESS;
    const message = createInviteProgressNotificationMessage({
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
      type: "INVITE_PROGRESS",
      title: message.title,
      body: message.body,
      metadata: { redemptionId: notification.redemptionId },
      campaignKey,
      variantId: message.variantId,
    });
  }

  async notifyQualifyReminder(notification: InviteQualifyReminderNotification): Promise<void> {
    const campaignKey = TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.INVITE_QUALIFY_REMINDER;
    const message = createInviteQualifyReminderNotificationMessage({
      inviterName: notification.inviterName,
      locale: await this.localeReader.getLocale(notification.inviteeId),
      variantContext: {
        campaignKey,
        recipientId: notification.inviteeId,
        occurrenceKey: notification.redemptionId,
      },
    });
    await this.notificationPublisher.publish({
      userId: notification.inviteeId,
      type: "INVITE_QUALIFY_REMINDER",
      title: message.title,
      body: message.body,
      metadata: { redemptionId: notification.redemptionId },
      // 사용자가 한 행동의 결과가 아니라 사용 시작을 권하는 알림이라 수신 동의·야간·하루 한도를 따른다
      purpose: "ENGAGEMENT",
      campaignKey,
      variantId: message.variantId,
    });
  }

  async isInQuietHours(userId: string, at: Date): Promise<boolean> {
    const quietUserIds = await this.quietHoursReader.findUsersInQuietHours([userId], at);
    return quietUserIds.has(userId);
  }
}
