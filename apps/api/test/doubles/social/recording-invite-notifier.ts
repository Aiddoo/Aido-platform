import {
  type InviteJoinedNotification,
  InviteNotifierPort,
  type InviteProgressNotification,
  type InviteQualifyReminderNotification,
  type InviteRewardedNotification,
} from "#api/modules/social/invite-redemptions/application/ports/invite-notifier.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 보낸 알림을 종류별로 id VO를 값으로 풀어 남긴다. isDown이면 발송 장애처럼 던지고, quietUserIds는 야간인 사용자다
export class RecordingInviteNotifier extends InviteNotifierPort {
  readonly joined: { inviterId: string; inviteeName: string; redemptionId: string }[] = [];
  readonly rewarded: {
    recipientId: string;
    redemptionId: string;
    premiumDays: number;
    friendSlots: number;
  }[] = [];
  readonly progress: { inviterId: string; inviteeName: string; redemptionId: string }[] = [];
  readonly qualifyReminders: {
    inviteeId: string;
    inviterName: string;
    redemptionId: string;
  }[] = [];
  readonly quietUserIds = new Set<string>();
  isDown = false;

  async notifyInviteJoined(notification: InviteJoinedNotification): Promise<void> {
    this.#throwIfDown();
    this.joined.push({
      inviterId: notification.inviterId.value,
      inviteeName: notification.inviteeName,
      redemptionId: notification.redemptionId.value,
    });
  }

  async notifyInviteRewarded(notification: InviteRewardedNotification): Promise<void> {
    this.#throwIfDown();
    this.rewarded.push({
      recipientId: notification.recipientId.value,
      redemptionId: notification.redemptionId.value,
      premiumDays: notification.premiumDays,
      friendSlots: notification.friendSlots,
    });
  }

  async notifyInviteProgress(notification: InviteProgressNotification): Promise<void> {
    this.#throwIfDown();
    this.progress.push({
      inviterId: notification.inviterId.value,
      inviteeName: notification.inviteeName,
      redemptionId: notification.redemptionId.value,
    });
  }

  async notifyQualifyReminder(notification: InviteQualifyReminderNotification): Promise<void> {
    this.#throwIfDown();
    this.qualifyReminders.push({
      inviteeId: notification.inviteeId.value,
      inviterName: notification.inviterName,
      redemptionId: notification.redemptionId.value,
    });
  }

  async isInQuietHours(userId: UserId, _at: Temporal.Instant): Promise<boolean> {
    return this.quietUserIds.has(userId.value);
  }

  #throwIfDown(): void {
    if (this.isDown) {
      throw new Error("push outage");
    }
  }
}
