import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../../../shared/domain/todo-comment-id.vo.js";

export abstract class TodoCommentLikeReaderPort {
  /** commentIds 가운데 viewer의 좋아요가 켜진 글 id */
  abstract listLikedCommentIds(
    commentIds: readonly TodoCommentId[],
    viewerId: UserId,
  ): Promise<ReadonlySet<string>>;
}
