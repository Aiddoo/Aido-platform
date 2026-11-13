import {
  CheerNotifierPort,
  type CheerSentNotification,
} from "#api/modules/social/cheers/application/ports/cheer-notifier.port";

export class RecordingCheerNotifier extends CheerNotifierPort {
  readonly sent: CheerSentNotification[] = [];

  async notifyCheerSent(notification: CheerSentNotification): Promise<void> {
    this.sent.push(notification);
  }
}
