import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/index";

import type { TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";

/** viewer가 할 일의 댓글에 접근할 수 있는지 확인하고, 삭제 권한 판단에 쓰는 할 일 주인 ID를 돌려준다 */
export async function assertTodoCommentAccess(
  reader: Pick<TodoCommentReaderPort, "findAccessibleTodoOwnerId">,
  todoId: number,
  viewerId: string,
): Promise<string> {
  const todoOwnerId = await reader.findAccessibleTodoOwnerId(todoId, viewerId);

  if (todoOwnerId == null) {
    throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
  }
  return todoOwnerId;
}
