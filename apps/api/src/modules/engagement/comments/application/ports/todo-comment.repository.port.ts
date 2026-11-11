import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import type { TodoComment } from "../../domain/todo-comment.aggregate.js";

export abstract class TodoCommentRepositoryPort {
  abstract nextId(): Promise<TodoCommentId>;
  abstract findByIdAndTodoId(commentId: TodoCommentId, todoId: TodoId): Promise<TodoComment | null>;
  /** 작성자가 이 멱등 키들로 이미 쓴 글. 순서는 정하지 않는다 */
  abstract listByAuthorIdAndClientRequestIds(
    authorId: UserId,
    clientRequestIds: readonly string[],
  ): Promise<TodoComment[]>;
  /** 새 글이 같은 작성자의 다른 글과 멱등 키가 겹치면 TodoCommentIdempotencyRace를 던진다 */
  abstract save(comment: TodoComment): Promise<void>;
}
