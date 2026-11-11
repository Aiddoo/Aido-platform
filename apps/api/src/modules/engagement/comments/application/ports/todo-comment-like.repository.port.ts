import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import type { TodoCommentLike } from "../../domain/todo-comment-like.entity.js";

export abstract class TodoCommentLikeRepositoryPort {
  abstract findByCommentIdAndUserId(
    commentId: TodoCommentId,
    userId: UserId,
  ): Promise<TodoCommentLike | null>;
  abstract save(like: TodoCommentLike): Promise<void>;
  /** 지운 글에 남은 좋아요를 모두 끈다. 알림 이력은 그대로 둔다 */
  abstract deactivateAllByCommentId(commentId: TodoCommentId, now: Temporal.Instant): Promise<void>;
}
