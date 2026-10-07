import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/index";

import type { TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";

export async function assertTodoCommentAccess(
  reader: Pick<TodoCommentReaderPort, "canAccessTodo">,
  todoId: number,
  viewerId: string,
): Promise<void> {
  const canAccess = await reader.canAccessTodo(todoId, viewerId);

  if (!canAccess) {
    throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
  }
}
