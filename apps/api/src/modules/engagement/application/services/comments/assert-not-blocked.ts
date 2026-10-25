import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/index";

import type { TodoCommentBlockReaderPort } from "../../ports/comments/todo-comment-block-reader.port.js";

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
