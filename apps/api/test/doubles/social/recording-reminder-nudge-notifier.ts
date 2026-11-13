import {
  ReminderNudgeNotifierPort,
  type ReminderNudgeSentNotification,
} from "#api/modules/social/reminder-nudges/application/ports/reminder-nudge-notifier.port";

export class RecordingReminderNudgeNotifier extends ReminderNudgeNotifierPort {
  readonly sent: ReminderNudgeSentNotification[] = [];

  async notifyNudgeSent(notification: ReminderNudgeSentNotification): Promise<void> {
    this.sent.push(notification);
  }
}
