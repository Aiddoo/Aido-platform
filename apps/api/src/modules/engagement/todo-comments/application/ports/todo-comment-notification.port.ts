import type { TodoCommentKind } from "@aido/api/vocabulary";

import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../../domain/todo-comment-id.vo.js";

export interface TodoCommentActivityNotificationInput {
  readonly recipientId: UserId;
  readonly senderId: UserId;
  readonly senderName: string | null;
  readonly todoId: TodoId;
  readonly commentId: TodoCommentId;
  /** 이 글이 속한 묶음의 머리 댓글. 알림 payload 이름은 구 앱 호환으로 유지한다 */
  readonly threadRootId: TodoCommentId;
}

export interface TodoCommentWrittenInput extends TodoCommentActivityNotificationInput {
  /**
   * 무엇에 단 글인지. null이면 할 일에 단 댓글로 할 일 주인이 받고,
   * 아니면 답글 대상(댓글 또는 답글) 작성자가 받는다.
   */
  readonly replyTarget: TodoCommentKind | null;
  /** 한 번에 이어 쓴 글 수. 여러 개여도 알림은 한 건이고, 개수는 문구가 말한다. */
  readonly commentCount: number;
}

export abstract class TodoCommentNotificationPort {
  abstract notifyCommentsWritten(input: TodoCommentWrittenInput): Promise<void>;
  /** 호출자 UOW에서 알림과 push outbox만 저장하며, 외부 push 발행은 실제 커밋 뒤 시작한다. */
  abstract notifyCommentLiked(input: TodoCommentActivityNotificationInput): Promise<void>;
}
