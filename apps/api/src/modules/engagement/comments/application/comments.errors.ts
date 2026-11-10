import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { TodoCommentBlockReaderPort } from "./ports/todo-comment-block-reader.port.js";
import type { TodoCommentReaderPort } from "./ports/todo-comment.reader.port.js";

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

/** 상대 댓글에 답글·좋아요를 남기기 전에 확인한다. 누가 차단했는지는 오류에 담지 않는다. */
export async function assertNotBlocked(
  blockReader: Pick<TodoCommentBlockReaderPort, "findBlockedCounterpartIds">,
  actorId: string,
  counterpartId: string,
): Promise<void> {
  const blockedIds = await blockReader.findBlockedCounterpartIds(actorId, [counterpartId]);

  if (blockedIds.has(counterpartId)) {
    throw new ApplicationException(ErrorCode.BLOCK_2204);
  }
}
