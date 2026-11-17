import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../../../shared/domain/todo-comment-id.vo.js";
import type { TodoCommentReadModel } from "../read-models/todo-comment.read-model.js";

/** id로 고른 글과 작성자 이름. 쓰기 Aggregate와 응답용 조회 결과를 섞지 않는다 */
export abstract class TodoCommentReaderPort {
  abstract findComment(
    todoId: TodoId,
    commentId: TodoCommentId,
  ): Promise<TodoCommentReadModel | null>;
  /** 요청한 id 순서대로 찾은 글만 돌려준다 */
  abstract listComments(
    todoId: TodoId,
    commentIds: readonly TodoCommentId[],
  ): Promise<TodoCommentReadModel[]>;
  /** 이름이 없으면 Aido ID(userTag)다. 사용자가 없으면 null이다 */
  abstract findUserDisplayName(userId: UserId): Promise<string | null>;
}
