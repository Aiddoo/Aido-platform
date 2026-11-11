import type { TodoCommentSort } from "@aido/api/vocabulary";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import { commentNotFound, invalidCommentRequest, todoNotFound } from "../comments.errors.js";
import type { TodoCommentBlockReaderPort } from "../ports/todo-comment-block-reader.port.js";
import type {
  TodoCommentCursorCodecPort,
  TodoConversationCursor,
} from "../ports/todo-comment-cursor-codec.port.js";
import type { TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import {
  listCommentAuthorIds,
  listCommentIds,
  type TodoCommentReadModel,
  type TodoCommentRootPosition,
  type TodoConversationPage,
} from "../read-models/todo-comment.read-model.js";
import type {
  TodoConversationPageMode,
  TodoConversationScope,
} from "../todo-comment-page.constants.js";

export interface GetTodoConversationQuery {
  readonly todoId: number;
  readonly viewerId: string;
  readonly sort: TodoCommentSort;
  readonly focusCommentId?: string;
  readonly before?: string;
  readonly after?: string;
  readonly size: number;
}

interface ConversationAnchor {
  readonly mode: TodoConversationPageMode;
  readonly scope: TodoConversationScope;
  readonly commentId?: TodoCommentId;
  readonly threadId?: TodoCommentId;
  readonly position?: TodoCommentRootPosition;
}

interface GetTodoConversationDependencies {
  readonly reader: Pick<
    TodoCommentReaderPort,
    "findAccessibleTodoOwnerId" | "listConversation" | "listComments" | "listLikedCommentIds"
  >;
  readonly blockReader: Pick<TodoCommentBlockReaderPort, "findBlockedCounterpartIds">;
  readonly cursorCodec: Pick<
    TodoCommentCursorCodecPort,
    "decodeConversation" | "encodeConversation"
  >;
}

const EMPTY_VIEWER_SETS = {
  likedCommentIds: new Set<string>(),
  blockedAuthorIds: new Set<string>(),
};

/** 1.14.0 이하 앱의 v1 대화. 묶음 순서를 지키고 묶음 안은 머리 다음 답글을 작성 순으로 세운다 */
export class GetTodoConversationUseCase {
  readonly #dependencies: GetTodoConversationDependencies;

  constructor(dependencies: GetTodoConversationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetTodoConversationQuery): Promise<TodoConversationPage> {
    const { reader, blockReader, cursorCodec } = this.#dependencies;
    const todoId = TodoId.reconstitute(query.todoId);
    const viewerId = UserId.reconstitute(query.viewerId);
    if ((await reader.findAccessibleTodoOwnerId(todoId, viewerId)) == null) {
      throw todoNotFound(query.todoId);
    }
    const anchor = this.#toAnchor(query);
    const window = await reader.listConversation({
      todoId,
      sort: query.sort,
      size: query.size,
      mode: anchor.mode,
      scope: anchor.scope,
      anchorCommentId: anchor.commentId,
      anchorThreadId: anchor.threadId,
      anchorPosition: anchor.position,
    });
    const focusedItem = window?.anchorIndex == null ? undefined : window.items[window.anchorIndex];
    // 없거나 대화에서 사라진 focus는 다른 묶음으로 바꾸지 않고 빈 대화로 연다
    if (
      anchor.mode === "FOCUS" &&
      (window == null || focusedItem == null || focusedItem.id !== anchor.commentId?.value)
    ) {
      return this.#toEmptyPage(query);
    }
    if (window == null) {
      throw invalidCommentRequest();
    }

    const focusItem = this.#findFocusItem(window.items, window.anchorIndex, anchor);
    const precedingThreadComments = await this.#listPrecedingThreadComment(
      todoId,
      focusItem,
      window.items,
    );
    const visibleComments = [...window.items, ...precedingThreadComments];
    const [likedCommentIds, blockedAuthorIds] = await Promise.all([
      reader.listLikedCommentIds(listCommentIds(visibleComments), viewerId),
      blockReader.findBlockedCounterpartIds(viewerId, listCommentAuthorIds(visibleComments)),
    ]);
    const first = window.items.at(0);
    const last = window.items.at(-1);

    return {
      items: window.items,
      nextItem: window.nextItem,
      focus:
        focusItem == null || window.anchorIndex == null
          ? null
          : {
              commentId: focusItem.id,
              itemIndex: window.anchorIndex,
              precedingThreadComments,
            },
      viewer: { viewerId: query.viewerId, likedCommentIds, blockedAuthorIds },
      pagination: {
        previousCursor:
          window.hasPrevious && first != null
            ? cursorCodec.encodeConversation(first, query.sort, anchor.scope)
            : null,
        nextCursor:
          window.hasNext && last != null
            ? cursorCodec.encodeConversation(last, query.sort, anchor.scope)
            : null,
        hasPrevious: window.hasPrevious,
        hasNext: window.hasNext,
        size: query.size,
      },
    };
  }

  #toAnchor(query: GetTodoConversationQuery): ConversationAnchor {
    if (query.focusCommentId != null) {
      return {
        mode: "FOCUS",
        scope: "THREAD",
        commentId: TodoCommentId.reconstitute(query.focusCommentId),
      };
    }
    if (query.before != null) {
      return { mode: "BEFORE", ...this.#fromCursor(this.#decode(query.before, query)) };
    }
    if (query.after != null) {
      return { mode: "AFTER", ...this.#fromCursor(this.#decode(query.after, query)) };
    }
    return { mode: "INITIAL", scope: "TODO" };
  }

  #decode(cursor: string, query: GetTodoConversationQuery): TodoConversationCursor {
    const decoded = this.#dependencies.cursorCodec.decodeConversation(cursor, query.sort);
    if (decoded.todoId !== query.todoId) {
      throw invalidCommentRequest();
    }
    return decoded;
  }

  #fromCursor(cursor: TodoConversationCursor): Omit<ConversationAnchor, "mode"> {
    return {
      scope: cursor.scope,
      commentId: TodoCommentId.reconstitute(cursor.commentId),
      threadId: TodoCommentId.reconstitute(cursor.threadId),
      position: cursor.position,
    };
  }

  #findFocusItem(
    items: readonly TodoCommentReadModel[],
    anchorIndex: number | null,
    anchor: ConversationAnchor,
  ): TodoCommentReadModel | null {
    if (anchor.mode !== "FOCUS") {
      return null;
    }
    const item = anchorIndex == null ? undefined : items[anchorIndex];
    if (item == null || item.id !== anchor.commentId?.value) {
      throw commentNotFound(anchor.commentId?.value ?? "");
    }
    return item;
  }

  #toEmptyPage(query: GetTodoConversationQuery): TodoConversationPage {
    return {
      items: [],
      nextItem: null,
      focus: null,
      viewer: { viewerId: query.viewerId, ...EMPTY_VIEWER_SETS },
      pagination: {
        previousCursor: null,
        nextCursor: null,
        hasPrevious: false,
        hasNext: false,
        size: query.size,
      },
    };
  }

  /** 1.14.0 이하 앱은 focus 답글 앞에 묶음 머리가 보여야 대화를 이어 그린다 */
  async #listPrecedingThreadComment(
    todoId: TodoId,
    focusItem: TodoCommentReadModel | null,
    pageItems: readonly TodoCommentReadModel[],
  ): Promise<TodoCommentReadModel[]> {
    const threadCommentId = focusItem?.threadCommentId;
    if (threadCommentId == null || pageItems.some((item) => item.id === threadCommentId)) {
      return [];
    }
    return this.#dependencies.reader.listComments(todoId, [
      TodoCommentId.reconstitute(threadCommentId),
    ]);
  }
}
