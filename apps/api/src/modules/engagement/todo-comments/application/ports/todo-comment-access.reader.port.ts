import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoDetailsReadModel } from "../read-models/todo-comment.read-model.js";

/** 댓글을 읽고 쓸 수 있는 할 일인지. 주인이거나, 공개 할 일이면 주인과 친구여야 한다 */
export abstract class TodoCommentAccessReaderPort {
  abstract findAccessibleTodoDetails(
    todoId: TodoId,
    viewerId: UserId,
  ): Promise<TodoDetailsReadModel | null>;
  /** viewer가 볼 수 있는 할 일이면 주인 ID, 없거나 볼 수 없으면 null */
  abstract findAccessibleTodoOwnerId(todoId: TodoId, viewerId: UserId): Promise<UserId | null>;
}
