// 큐 payload라 id·이름은 문자열 그대로 싣는다. 할 일이 없는 콕 알림(NUDGE)으로 보낸다
export interface ReminderNudgeSentNotification {
  readonly nudgeId: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly senderName: string;
  readonly message?: string;
}

// 리마인드 콕을 저장한 트랜잭션 안에서 알림 작업을 넣어 함께 커밋한다
export abstract class ReminderNudgeNotifierPort {
  abstract notifyNudgeSent(notification: ReminderNudgeSentNotification): Promise<void>;
}
