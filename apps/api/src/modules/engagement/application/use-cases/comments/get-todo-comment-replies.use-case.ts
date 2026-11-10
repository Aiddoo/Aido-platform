import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import {
  TODO_COMMENT_PAGE_DIRECTION,
  type ListTodoCommentRepliesParams,
  type TodoCommentRepliesResult,
} from "../../models/comments/todo-comment.types.js";
import { type TodoCommentBlockReaderPort } from "../../ports/comments/todo-comment-block-reader.port.js";
import { type TodoCommentCursorCodecPort } from "../../ports/comments/todo-comment-cursor-codec.port.js";
import { type TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";
import {
  collectCommentAuthorIds,
  collectCommentIds,
  toTodoCommentCursorPagination,
} from "../../presenters/comments/index.js";
import { assertTodoCommentAccess } from "../../services/comments/assert-todo-comment-access.js";

export interface GetTodoCommentRepliesInput {
  readonly todoId: number;
  readonly viewerId: string;
  readonly threadCommentId: string;
  readonly size: number;
  readonly cursor?: string;
  readonly aroundReplyId?: string;
}

interface GetTodoCommentRepliesDependencies {
  readonly reader: Pick<
    TodoCommentReaderPort,
    "findAccessibleTodoOwnerId" | "findCommentRecord" | "listReplies" | "findLikedCommentIds"
  >;
  readonly blockReader: Pick<TodoCommentBlockReaderPort, "findBlockedCounterpartIds">;
  readonly cursorCodec: Pick<TodoCommentCursorCodecPort, "decodeReplies" | "encodeReplies">;
}

export class GetTodoCommentReplies {
  readonly #dependencies: GetTodoCommentRepliesDependencies;

  constructor(dependencies: GetTodoCommentRepliesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoCommentRepliesInput): Promise<TodoCommentRepliesResult> {
    await assertTodoCommentAccess(this.#dependencies.reader, input.todoId, input.viewerId);
    const thread = await this.#dependencies.reader.findCommentRecord(
      input.todoId,
      input.threadCommentId,
    );
    if (thread == null || thread.threadCommentId != null) {
      throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.threadCommentId });
    }

    const params = this.toParams(input);
    const window =
      (await this.#dependencies.reader.listReplies(params)) ??
      (params.mode === "AROUND"
        ? await this.#dependencies.reader.listReplies({ ...params, mode: "INITIAL" })
        : null);
    if (window == null) {
      throw new ApplicationException(ErrorCode.SYS_0002);
    }

    const [likedCommentIds, blockedAuthorIds] = await Promise.all([
      this.#dependencies.reader.findLikedCommentIds(
        collectCommentIds(window.items),
        input.viewerId,
      ),
      this.#dependencies.blockReader.findBlockedCounterpartIds(
        input.viewerId,
        collectCommentAuthorIds(window.items),
      ),
    ]);
    const first = window.items.at(0);
    const last = window.items.at(-1);

    return {
      items: window.items,
      viewer: { viewerId: input.viewerId, likedCommentIds, blockedAuthorIds },
      pagination: toTodoCommentCursorPagination({
        size: input.size,
        hasPrevious: window.hasPrevious,
        hasNext: window.hasNext,
        previousCursor:
          window.hasPrevious && first != null
            ? this.#dependencies.cursorCodec.encodeReplies(
                first,
                TODO_COMMENT_PAGE_DIRECTION.BEFORE,
              )
            : null,
        nextCursor:
          window.hasNext && last != null
            ? this.#dependencies.cursorCodec.encodeReplies(last, TODO_COMMENT_PAGE_DIRECTION.AFTER)
            : null,
      }),
    };
  }

  private toParams(input: GetTodoCommentRepliesInput): ListTodoCommentRepliesParams {
    const base = { todoId: input.todoId, threadCommentId: input.threadCommentId, size: input.size };

    if (input.cursor != null) {
      const cursor = this.#dependencies.cursorCodec.decodeReplies(input.cursor);
      if (cursor.todoId !== input.todoId || cursor.threadCommentId !== input.threadCommentId) {
        throw new ApplicationException(ErrorCode.SYS_0002);
      }

      return { ...base, mode: cursor.direction, anchorReplyId: cursor.replyId };
    }

    if (input.aroundReplyId != null) {
      return { ...base, mode: "AROUND", anchorReplyId: input.aroundReplyId };
    }

    return { ...base, mode: "INITIAL" };
  }
}
