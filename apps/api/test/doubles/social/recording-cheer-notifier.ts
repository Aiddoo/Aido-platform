import {
  CheerNotifierPort,
  type CheerSentNotification,
} from "#api/modules/social/cheers/application/ports/cheer-notifier.port";

// 비교하기 쉽게 id VO를 값으로 풀어 남긴다
export interface RecordedCheerSent {
  readonly cheerId: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly senderName: string;
  readonly message?: string;
}

export class RecordingCheerNotifier extends CheerNotifierPort {
  readonly sent: RecordedCheerSent[] = [];

  async notifyCheerSent(notification: CheerSentNotification): Promise<void> {
    this.sent.push({
      ...notification,
      cheerId: notification.cheerId.value,
      senderId: notification.senderId.value,
      receiverId: notification.receiverId.value,
    });
  }
}
