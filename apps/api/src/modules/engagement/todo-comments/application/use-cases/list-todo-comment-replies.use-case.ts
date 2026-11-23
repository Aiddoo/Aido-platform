import type { TodoCommentLikeReaderPort } from "#api/modules/engagement/todo-comment-likes/engagement-todo-comment-likes.public";
import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import type { TodoCommentAccessReaderPort } from "../ports/todo-comment-access.reader.port.js";
import type { TodoCommentBlockReaderPort } from "../ports/todo-comment-block-reader.port.js";
import type { TodoCommentCursorCodecPort } from "../ports/todo-comment-cursor-codec.port.js";
import type {
  ListTodoCommentRepliesParams,
  TodoCommentReplyReaderPort,
} from "../ports/todo-comment-reply.reader.port.js";
import type { TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import {
  listCommentAuthorIds,
  listCommentIds,
  type TodoCommentRepliesPageReadModel,
} from "../read-models/todo-comment.read-model.js";
import { commentNotFound, invalidCommentRequest, todoNotFound } from "../todo-comments.errors.js";

export interface ListTodoCommentRepliesQuery {
  readonly todoId: number;
  readonly viewerId: string;
  readonly threadCommentId: string;
  readonly size: number;
  readonly cursor?: string;
  readonly aroundReplyId?: string;
}

interface ListTodoCommentRepliesDependencies {
  readonly accessReader: Pick<TodoCommentAccessReaderPort, "findAccessibleTodoOwnerId">;
  readonly reader: Pick<TodoCommentReaderPort, "findComment">;
  readonly replyReader: Pick<TodoCommentReplyReaderPort, "listReplies">;
  readonly likeReader: Pick<TodoCommentLikeReaderPort, "listLikedCommentIds">;
  readonly blockReader: Pick<TodoCommentBlockReaderPort, "findBlockedCounterpartIds">;
  readonly cursorCodec: Pick<TodoCommentCursorCodecPort, "decodeReplies" | "encodeReplies">;
}

export class ListTodoCommentRepliesUseCase {
  readonly #dependencies: ListTodoCommentRepliesDependencies;

  constructor(dependencies: ListTodoCommentRepliesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ListTodoCommentRepliesQuery): Promise<TodoCommentRepliesPageReadModel> {
    const { accessReader, reader, replyReader, likeReader, blockReader, cursorCodec } =
      this.#dependencies;
    const todoId = TodoId.reconstitute(query.todoId);
    const viewerId = UserId.reconstitute(query.viewerId);
    const threadCommentId = TodoCommentId.reconstitute(query.threadCommentId);
    if ((await accessReader.findAccessibleTodoOwnerId(todoId, viewerId)) == null) {
      throw todoNotFound(todoId);
    }
    const thread = await reader.findComment(todoId, threadCommentId);
    if (thread == null || thread.threadCommentId != null) {
      throw commentNotFound(threadCommentId);
    }

    const params = this.#toParams(query, { todoId, threadCommentId, size: query.size });
    // 기준 답글이 지워졌거나 다른 묶음이면 첫 페이지로 연다
    const window =
      (await replyReader.listReplies(params)) ??
      (params.mode === "AROUND"
        ? await replyReader.listReplies({ ...params, mode: "INITIAL" })
        : null);
    if (window == null) {
      throw invalidCommentRequest();
    }

    const [likedCommentIds, blockedAuthorIds] = await Promise.all([
      likeReader.listLikedCommentIds(listCommentIds(window.items), viewerId),
      blockReader.findBlockedCounterpartIds(viewerId, listCommentAuthorIds(window.items)),
    ]);
    const first = window.items.at(0);
    const last = window.items.at(-1);

    return {
      items: window.items,
      viewer: { viewerId: query.viewerId, likedCommentIds, blockedAuthorIds },
      pagination: {
        previousCursor:
          window.hasPrevious && first != null ? cursorCodec.encodeReplies(first, "BEFORE") : null,
        nextCursor:
          window.hasNext && last != null ? cursorCodec.encodeReplies(last, "AFTER") : null,
        hasPrevious: window.hasPrevious,
        hasNext: window.hasNext,
        size: query.size,
      },
    };
  }

  #toParams(
    query: ListTodoCommentRepliesQuery,
    base: Pick<ListTodoCommentRepliesParams, "todoId" | "threadCommentId" | "size">,
  ): ListTodoCommentRepliesParams {
    if (query.cursor != null) {
      const cursor = this.#dependencies.cursorCodec.decodeReplies(query.cursor);
      if (
        !cursor.todoId.equals(base.todoId) ||
        !cursor.threadCommentId.equals(base.threadCommentId)
      ) {
        throw invalidCommentRequest();
      }
      return { ...base, mode: cursor.direction, anchorReplyId: cursor.replyId };
    }
    if (query.aroundReplyId != null) {
      return {
        ...base,
        mode: "AROUND",
        anchorReplyId: TodoCommentId.reconstitute(query.aroundReplyId),
      };
    }
    return { ...base, mode: "INITIAL" };
  }
}
