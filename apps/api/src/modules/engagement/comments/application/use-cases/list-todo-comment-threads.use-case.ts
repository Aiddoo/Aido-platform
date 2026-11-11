import type { TodoCommentSort } from "@aido/api/vocabulary";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import { invalidCommentRequest, todoNotFound } from "../comments.errors.js";
import type { TodoCommentBlockReaderPort } from "../ports/todo-comment-block-reader.port.js";
import type { TodoCommentCursorCodecPort } from "../ports/todo-comment-cursor-codec.port.js";
import type {
  ListTodoCommentThreadsParams,
  TodoCommentReaderPort,
} from "../ports/todo-comment.reader.port.js";
import {
  listCommentAuthorIds,
  listCommentIds,
  type TodoCommentThreadAnchorReadModel,
  type TodoCommentThreadsPage,
} from "../read-models/todo-comment.read-model.js";
import type { TodoCommentPageDirection } from "../todo-comment-page.constants.js";

/** v1은 before·after로 방향을 주고, v2는 cursor에 담긴 방향을 쓴다 */
export type TodoCommentThreadsPageRequest =
  | { readonly kind: "FIRST" }
  | {
      readonly kind: "CURSOR";
      readonly cursor: string;
      readonly direction?: TodoCommentPageDirection;
    }
  | { readonly kind: "ANCHOR"; readonly commentId: string };

export interface ListTodoCommentThreadsQuery {
  readonly todoId: number;
  readonly viewerId: string;
  readonly sort: TodoCommentSort;
  readonly size: number;
  readonly page: TodoCommentThreadsPageRequest;
}

interface ListTodoCommentThreadsDependencies {
  readonly reader: Pick<
    TodoCommentReaderPort,
    "findAccessibleTodoOwnerId" | "findComment" | "listThreads" | "listLikedCommentIds"
  >;
  readonly blockReader: Pick<TodoCommentBlockReaderPort, "findBlockedCounterpartIds">;
  readonly cursorCodec: Pick<TodoCommentCursorCodecPort, "decodeThreads" | "encodeThreads">;
}

interface ResolvedPage {
  readonly params: ListTodoCommentThreadsParams;
  readonly anchor: TodoCommentThreadAnchorReadModel | null;
}

export class ListTodoCommentThreadsUseCase {
  readonly #dependencies: ListTodoCommentThreadsDependencies;

  constructor(dependencies: ListTodoCommentThreadsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ListTodoCommentThreadsQuery): Promise<TodoCommentThreadsPage> {
    const { reader, blockReader, cursorCodec } = this.#dependencies;
    const todoId = TodoId.reconstitute(query.todoId);
    const viewerId = UserId.reconstitute(query.viewerId);
    if ((await reader.findAccessibleTodoOwnerId(todoId, viewerId)) == null) {
      throw todoNotFound(query.todoId);
    }
    const page = await this.#resolvePage(query, todoId);
    const anchoredWindow = await reader.listThreads(page.params);
    // 기준 묶음이 목록에서 보이지 않으면 오류 대신 첫 페이지와 빈 anchor로 연다
    const window =
      anchoredWindow == null && page.params.mode === "ANCHOR"
        ? await reader.listThreads({ ...page.params, mode: "INITIAL" })
        : anchoredWindow;
    if (window == null) {
      throw invalidCommentRequest();
    }

    const comments = window.items.flatMap((item) =>
      item.previewReply == null ? [item.comment] : [item.comment, item.previewReply],
    );
    const [likedCommentIds, blockedAuthorIds] = await Promise.all([
      reader.listLikedCommentIds(listCommentIds(comments), viewerId),
      blockReader.findBlockedCounterpartIds(viewerId, [
        ...listCommentAuthorIds(comments),
        ...window.items.flatMap((item) =>
          item.participantAuthors.map((author) => UserId.reconstitute(author.id)),
        ),
      ]),
    ]);
    const first = window.items.at(0)?.comment;
    const last = window.items.at(-1)?.comment;

    return {
      items: window.items,
      viewer: { viewerId: query.viewerId, likedCommentIds, blockedAuthorIds },
      pagination: {
        previousCursor:
          window.hasPrevious && first != null
            ? cursorCodec.encodeThreads(first, query.sort, "BEFORE")
            : null,
        nextCursor:
          window.hasNext && last != null
            ? cursorCodec.encodeThreads(last, query.sort, "AFTER")
            : null,
        hasPrevious: window.hasPrevious,
        hasNext: window.hasNext,
        size: query.size,
      },
      anchor: anchoredWindow == null ? null : page.anchor,
    };
  }

  async #resolvePage(query: ListTodoCommentThreadsQuery, todoId: TodoId): Promise<ResolvedPage> {
    const base = { todoId, sort: query.sort, size: query.size };
    switch (query.page.kind) {
      case "FIRST":
        return { params: { ...base, mode: "INITIAL" }, anchor: null };
      case "CURSOR": {
        const cursor = this.#dependencies.cursorCodec.decodeThreads(query.page.cursor, query.sort);
        if (cursor.todoId !== query.todoId) {
          throw invalidCommentRequest();
        }
        return {
          params: {
            ...base,
            // 방향이 없는 cursor는 1.14.0 이하 앱의 다음 페이지 cursor다
            mode: query.page.direction ?? cursor.direction ?? "AFTER",
            anchorCommentId: TodoCommentId.reconstitute(cursor.rootId),
            anchorPosition: cursor.position,
          },
          anchor: null,
        };
      }
      case "ANCHOR": {
        const comment = await this.#dependencies.reader.findComment(
          todoId,
          TodoCommentId.reconstitute(query.page.commentId),
        );
        if (comment == null || comment.deletedAt != null) {
          return { params: { ...base, mode: "INITIAL" }, anchor: null };
        }
        const threadCommentId = comment.threadCommentId ?? comment.id;
        return {
          params: {
            ...base,
            mode: "ANCHOR",
            anchorCommentId: TodoCommentId.reconstitute(threadCommentId),
          },
          anchor: {
            threadCommentId,
            replyId: comment.threadCommentId == null ? null : comment.id,
          },
        };
      }
    }
  }
}
