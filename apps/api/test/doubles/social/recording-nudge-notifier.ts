import type { NudgeReplyKind } from "@aido/api/vocabulary";

import {
  type NudgeInteractionNotification,
  NudgeNotifierPort,
  type NudgeSentNotification,
} from "#api/modules/social/nudges/application/ports/nudge-notifier.port";

// 비교하기 쉽게 id VO를 값으로 풀어 남긴다
export interface RecordedNudgeSent {
  readonly nudgeId: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly senderName: string;
  readonly todoId: number;
  readonly todoTitle: string;
  readonly message?: string;
}

export type RecordedNudgeInteraction = {
  readonly nudgeId: number;
  readonly todoId: number;
  readonly actorId: string;
  readonly recipientId: string;
  readonly actorName: string;
  readonly todoTitle: string;
} & ({ readonly kind: "reply"; readonly replyKind: NudgeReplyKind } | { readonly kind: "thanks" });

function toRecordedInteraction(
  notification: NudgeInteractionNotification,
): RecordedNudgeInteraction {
  return {
    ...notification,
    nudgeId: notification.nudgeId.value,
    todoId: notification.todoId.value,
    actorId: notification.actorId.value,
    recipientId: notification.recipientId.value,
  };
}

// 답장·감사 알림은 배치 단위도 남긴다(감사는 100명씩 묶어 기록한다)
export class RecordingNudgeNotifier extends NudgeNotifierPort {
  readonly sent: RecordedNudgeSent[] = [];
  readonly interactions: RecordedNudgeInteraction[] = [];
  readonly interactionBatchSizes: number[] = [];

  async notifyNudgeSent(notification: NudgeSentNotification): Promise<void> {
    this.sent.push({
      ...notification,
      nudgeId: notification.nudgeId.value,
      senderId: notification.senderId.value,
      receiverId: notification.receiverId.value,
      todoId: notification.todoId.value,
    });
  }

  async recordInteraction(notification: NudgeInteractionNotification): Promise<void> {
    this.interactions.push(toRecordedInteraction(notification));
    this.interactionBatchSizes.push(1);
  }

  async recordInteractions(notifications: readonly NudgeInteractionNotification[]): Promise<void> {
    this.interactions.push(...notifications.map(toRecordedInteraction));
    this.interactionBatchSizes.push(notifications.length);
  }
}
