import {
  type InviteJoinedNotification,
  InviteNotifierPort,
  type InviteProgressNotification,
  type InviteQualifyReminderNotification,
  type InviteRewardedNotification,
} from "#api/modules/social/invite-redemptions/application/ports/invite-notifier.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 보낸 알림을 종류별로 남긴다. isDown이면 발송 장애처럼 던지고, quietUserIds는 야간인 사용자다
export class RecordingInviteNotifier extends InviteNotifierPort {
  readonly joined: InviteJoinedNotification[] = [];
  readonly rewarded: InviteRewardedNotification[] = [];
  readonly progress: InviteProgressNotification[] = [];
  readonly qualifyReminders: InviteQualifyReminderNotification[] = [];
  readonly quietUserIds = new Set<string>();
  isDown = false;

  async notifyInviteJoined(notification: InviteJoinedNotification): Promise<void> {
    this.#throwIfDown();
    this.joined.push(notification);
  }

  async notifyInviteRewarded(notification: InviteRewardedNotification): Promise<void> {
    this.#throwIfDown();
    this.rewarded.push(notification);
  }

  async notifyInviteProgress(notification: InviteProgressNotification): Promise<void> {
    this.#throwIfDown();
    this.progress.push(notification);
  }

  async notifyQualifyReminder(notification: InviteQualifyReminderNotification): Promise<void> {
    this.#throwIfDown();
    this.qualifyReminders.push(notification);
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
