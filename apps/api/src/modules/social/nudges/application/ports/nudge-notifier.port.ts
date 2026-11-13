import type { NudgeReplyKind } from "@aido/api/vocabulary";

export interface NudgeSentNotification {
  readonly nudgeId: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly senderName: string;
  readonly todoId: number;
  readonly todoTitle: string;
  readonly message?: string;
}

interface NudgeInteractionNotificationBase {
  readonly nudgeId: number;
  readonly todoId: number;
  readonly actorId: string;
  readonly recipientId: string;
  readonly actorName: string;
  readonly todoTitle: string;
}

export type NudgeInteractionNotification = NudgeInteractionNotificationBase &
  ({ readonly kind: "reply"; readonly replyKind: NudgeReplyKind } | { readonly kind: "thanks" });

export abstract class NudgeNotifierPort {
  // 콕 알림 작업은 콕을 저장한 트랜잭션 안에서 넣어 함께 커밋한다
  abstract notifyNudgeSent(notification: NudgeSentNotification): Promise<void>;
  // 답장·감사 알림은 호출한 트랜잭션 안에서 저장해 상태 변경과 함께 커밋·롤백된다
  abstract recordInteraction(notification: NudgeInteractionNotification): Promise<void>;
  abstract recordInteractions(
    notifications: readonly NudgeInteractionNotification[],
  ): Promise<void>;
}
