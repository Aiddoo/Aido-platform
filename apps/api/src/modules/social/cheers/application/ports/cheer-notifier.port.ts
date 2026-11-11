export interface CheerSentNotification {
  readonly cheerId: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly senderName: string;
  readonly message?: string;
}

// 응원 알림은 커밋 뒤 작업 큐에 넣고 기다리지 않는다
export abstract class CheerNotifierPort {
  abstract notifyCheerSent(notification: CheerSentNotification): void;
}
