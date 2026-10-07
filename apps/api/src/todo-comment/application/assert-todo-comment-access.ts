import { ErrorCode } from "@aido/errors";

import { ApplicationException } from "#api/shared/domain/index";

import type { TodoCommentReaderPort } from "./ports/todo-comment.reader.port.js";

export async function assertTodoCommentAccess(
  reader: TodoCommentReaderPort,
  todoId: number,
  viewerId: string,
): Promise<void> {
  const canAccess = await reader.canAccessTodo(todoId, viewerId);

  if (!canAccess) {
    throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
  }
}
