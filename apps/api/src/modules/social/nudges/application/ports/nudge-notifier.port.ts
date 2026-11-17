import type { NudgeReplyKind } from "@aido/api/vocabulary";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NudgeId } from "../../domain/nudge-id.vo.js";

export interface NudgeSentNotification {
  readonly nudgeId: NudgeId;
  readonly senderId: UserId;
  readonly receiverId: UserId;
  readonly senderName: string;
  readonly todoId: TodoId;
  readonly todoTitle: string;
  readonly message?: string;
}

interface NudgeInteractionNotificationBase {
  readonly nudgeId: NudgeId;
  readonly todoId: TodoId;
  readonly actorId: UserId;
  readonly recipientId: UserId;
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
