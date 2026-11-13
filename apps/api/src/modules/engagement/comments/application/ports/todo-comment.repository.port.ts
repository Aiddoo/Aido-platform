import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import type { TodoComment } from "../../domain/todo-comment.aggregate.js";

export abstract class TodoCommentRepositoryPort {
  abstract findByIdAndTodoId(commentId: TodoCommentId, todoId: TodoId): Promise<TodoComment | null>;
  /** 작성자가 이 멱등 키들로 이미 쓴 글. 순서는 정하지 않는다 */
  abstract listByAuthorIdAndClientRequestIds(
    authorId: UserId,
    clientRequestIds: readonly string[],
  ): Promise<TodoComment[]>;
  /** 새 글이 같은 작성자의 다른 글과 멱등 키가 겹치면 TodoCommentIdempotencyRace를 던진다 */
  abstract save(comment: TodoComment): Promise<void>;
  /** 여러 글을 한 문장으로 저장한다. 앞 글에 답하는 새 글이 같이 들어가도 된다. 멱등 키 겹침은 save와 같다 */
  abstract saveAll(comments: readonly TodoComment[]): Promise<void>;
}
