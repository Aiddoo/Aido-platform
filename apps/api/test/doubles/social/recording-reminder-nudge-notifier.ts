import {
  ReminderNudgeNotifierPort,
  type ReminderNudgeSentNotification,
} from "#api/modules/social/reminder-nudges/application/ports/reminder-nudge-notifier.port";

// 비교하기 쉽게 id VO를 값으로 풀어 남긴다
export interface RecordedReminderNudgeSent {
  readonly nudgeId: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly senderName: string;
  readonly message?: string;
}

export class RecordingReminderNudgeNotifier extends ReminderNudgeNotifierPort {
  readonly sent: RecordedReminderNudgeSent[] = [];

  async notifyNudgeSent(notification: ReminderNudgeSentNotification): Promise<void> {
    this.sent.push({
      ...notification,
      nudgeId: notification.nudgeId.value,
      senderId: notification.senderId.value,
      receiverId: notification.receiverId.value,
    });
  }
}
