import type { TodoCommentSort } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import {
  TODO_COMMENT_PAGE_DIRECTION,
  type ListTodoCommentThreadsParams,
  type TodoCommentPageDirection,
  type TodoCommentThreadAnchorRecord,
  type TodoCommentThreadsResult,
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

/** v1은 before/after로 방향을 주고, v2는 cursor에 담긴 방향을 쓴다. */
export type GetTodoCommentThreadsPage =
  | { readonly kind: "FIRST" }
  | {
      readonly kind: "CURSOR";
      readonly cursor: string;
      readonly direction?: TodoCommentPageDirection;
    }
  | { readonly kind: "ANCHOR"; readonly commentId: string };

export interface GetTodoCommentThreadsInput {
  readonly todoId: number;
  readonly viewerId: string;
  readonly sort: TodoCommentSort;
  readonly size: number;
  readonly page: GetTodoCommentThreadsPage;
}

interface GetTodoCommentThreadsDependencies {
  readonly reader: Pick<
    TodoCommentReaderPort,
    "findAccessibleTodoOwnerId" | "findCommentRecord" | "listThreads" | "findLikedCommentIds"
  >;
  readonly blockReader: Pick<TodoCommentBlockReaderPort, "findBlockedCounterpartIds">;
  readonly cursorCodec: Pick<TodoCommentCursorCodecPort, "decodeThreads" | "encodeThreads">;
}

interface ResolvedPage {
  readonly params: ListTodoCommentThreadsParams;
  readonly anchor: TodoCommentThreadAnchorRecord | null;
}

export class GetTodoCommentThreads {
  readonly #dependencies: GetTodoCommentThreadsDependencies;

  constructor(dependencies: GetTodoCommentThreadsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoCommentThreadsInput): Promise<TodoCommentThreadsResult> {
    await assertTodoCommentAccess(this.#dependencies.reader, input.todoId, input.viewerId);
    const page = await this.resolvePage(input);
    const anchoredWindow = await this.#dependencies.reader.listThreads(page.params);
    const window =
      anchoredWindow == null && page.params.mode === "ANCHOR"
        ? await this.#dependencies.reader.listThreads({ ...page.params, mode: "INITIAL" })
        : anchoredWindow;

    if (window == null) {
      throw new ApplicationException(ErrorCode.SYS_0002);
    }

    const records = window.items.flatMap((item) =>
      item.previewReply == null ? [item.comment] : [item.comment, item.previewReply],
    );
    const [likedCommentIds, blockedAuthorIds] = await Promise.all([
      this.#dependencies.reader.findLikedCommentIds(collectCommentIds(records), input.viewerId),
      this.#dependencies.blockReader.findBlockedCounterpartIds(input.viewerId, [
        ...collectCommentAuthorIds(records),
        ...window.items.flatMap((item) => item.participantAuthors.map((author) => author.id)),
      ]),
    ]);
    const first = window.items.at(0)?.comment;
    const last = window.items.at(-1)?.comment;

    return {
      items: window.items,
      viewer: { viewerId: input.viewerId, likedCommentIds, blockedAuthorIds },
      pagination: toTodoCommentCursorPagination({
        size: input.size,
        hasPrevious: window.hasPrevious,
        hasNext: window.hasNext,
        previousCursor:
          window.hasPrevious && first != null
            ? this.#dependencies.cursorCodec.encodeThreads(
                first,
                input.sort,
                TODO_COMMENT_PAGE_DIRECTION.BEFORE,
              )
            : null,
        nextCursor:
          window.hasNext && last != null
            ? this.#dependencies.cursorCodec.encodeThreads(
                last,
                input.sort,
                TODO_COMMENT_PAGE_DIRECTION.AFTER,
              )
            : null,
      }),
      anchor: anchoredWindow == null ? null : page.anchor,
    };
  }

  private async resolvePage(input: GetTodoCommentThreadsInput): Promise<ResolvedPage> {
    const base = { todoId: input.todoId, sort: input.sort, size: input.size };

    switch (input.page.kind) {
      case "FIRST":
        return { params: { ...base, mode: "INITIAL" }, anchor: null };
      case "CURSOR": {
        const cursor = this.#dependencies.cursorCodec.decodeThreads(input.page.cursor, input.sort);
        if (cursor.todoId !== input.todoId) {
          throw new ApplicationException(ErrorCode.SYS_0002);
        }

        return {
          params: {
            ...base,
            mode: input.page.direction ?? cursor.direction ?? TODO_COMMENT_PAGE_DIRECTION.AFTER,
            anchorCommentId: cursor.rootId,
            anchorPosition: cursor.position,
          },
          anchor: null,
        };
      }
      case "ANCHOR": {
        const record = await this.#dependencies.reader.findCommentRecord(
          input.todoId,
          input.page.commentId,
        );
        if (record == null || record.deletedAt != null) {
          return { params: { ...base, mode: "INITIAL" }, anchor: null };
        }

        const threadCommentId = record.threadCommentId ?? record.id;
        return {
          params: { ...base, mode: "ANCHOR", anchorCommentId: threadCommentId },
          anchor: {
            threadCommentId,
            replyId: record.threadCommentId == null ? null : record.id,
          },
        };
      }
    }
  }
}
