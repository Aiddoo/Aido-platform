import {
  CheerNotifierPort,
  type CheerSentNotification,
} from "#api/modules/social/cheers/application/ports/cheer-notifier.port";

export class RecordingCheerNotifier extends CheerNotifierPort {
  readonly sent: CheerSentNotification[] = [];

  notifyCheerSent(notification: CheerSentNotification): void {
    this.sent.push(notification);
  }
}
