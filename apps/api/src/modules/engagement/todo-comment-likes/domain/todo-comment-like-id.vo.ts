import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { EntityId } from "#api/shared/domain/model/entity-id";

import type { TodoCommentId } from "../../todo-comments/domain/todo-comment-id.vo.js";

/** 한 사람은 한 글에 좋아요 하나만 가진다. 저장 키는 (commentId, userId)다 */
export class TodoCommentLikeId extends EntityId<string> {
  static create(params: {
    readonly commentId: TodoCommentId;
    readonly userId: UserId;
  }): TodoCommentLikeId {
    return new TodoCommentLikeId(`${params.commentId.value}:${params.userId.value}`);
  }
}
