import type { TodoCommentSort, TodoConversationFocus, TodoConversationResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_COMMENT_LIMITS } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/domain/index";

import type {
  ConversationPageMode,
  TodoCommentRecord,
  TodoConversationCursor,
  TodoConversationPosition,
  TodoConversationScope,
} from "../../models/comments/todo-comment.types.js";
import { type TodoCommentCursorCodecPort } from "../../ports/comments/todo-comment-cursor-codec.port.js";
import { type TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";
import {
  collectCommentIds,
  toTodoCommentCursorPagination,
  toTodoConversationAncestorItems,
  toTodoConversationItems,
} from "../../presenters/comments/index.js";
import { assertTodoCommentAccess } from "../../services/comments/assert-todo-comment-access.js";

export interface GetTodoConversationInput {
  readonly todoId: number;
  readonly viewerId: string;
  readonly sort: TodoCommentSort;
  readonly focusCommentId?: string;
  readonly before?: string;
  readonly after?: string;
  readonly size: number;
}

interface ConversationAnchor {
  readonly mode: ConversationPageMode;
  readonly scope: TodoConversationScope;
  readonly commentId?: string;
  readonly threadId?: string;
  readonly position?: TodoConversationPosition;
}

function decodeCursor(
  cursor: string,
  sort: TodoCommentSort,
  todoId: number,
  cursorCodec: Pick<TodoCommentCursorCodecPort, "decodeConversation">,
): TodoConversationCursor {
  const decoded = cursorCodec.decodeConversation(cursor, sort);

  if (decoded.todoId !== todoId) {
    throw new ApplicationException(ErrorCode.SYS_0002);
  }

  return decoded;
}

function getAnchor(
  input: GetTodoConversationInput,
  cursorCodec: Pick<TodoCommentCursorCodecPort, "decodeConversation">,
): ConversationAnchor {
  if (input.focusCommentId !== undefined) {
    return { mode: "FOCUS", scope: "THREAD", commentId: input.focusCommentId };
  }

  if (input.before !== undefined) {
    const cursor = decodeCursor(input.before, input.sort, input.todoId, cursorCodec);
    return {
      mode: "BEFORE",
      scope: cursor.scope,
      commentId: cursor.commentId,
      threadId: cursor.threadId,
      position: cursor.position,
    };
  }

  if (input.after !== undefined) {
    const cursor = decodeCursor(input.after, input.sort, input.todoId, cursorCodec);
    return {
      mode: "AFTER",
      scope: cursor.scope,
      commentId: cursor.commentId,
      threadId: cursor.threadId,
      position: cursor.position,
    };
  }

  return { mode: "INITIAL", scope: "TODO" };
}

interface FocusAncestorContext {
  readonly records: readonly TodoCommentRecord[];
  readonly omittedCount: number;
}

interface GetTodoConversationDependencies {
  readonly reader: Pick<
    TodoCommentReaderPort,
    "canAccessTodo" | "listConversation" | "findAncestors" | "findLikedCommentIds"
  >;
  readonly cursorCodec: Pick<
    TodoCommentCursorCodecPort,
    "decodeConversation" | "encodeConversation"
  >;
}

export class GetTodoConversation {
  readonly #dependencies: GetTodoConversationDependencies;

  constructor(dependencies: GetTodoConversationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoConversationInput): Promise<TodoConversationResponse> {
    await assertTodoCommentAccess(this.#dependencies.reader, input.todoId, input.viewerId);
    const anchor = getAnchor(input, this.#dependencies.cursorCodec);
    const window = await this.#dependencies.reader.listConversation({
      todoId: input.todoId,
      sort: input.sort,
      size: input.size,
      mode: anchor.mode,
      scope: anchor.scope,
      anchorCommentId: anchor.commentId,
      anchorThreadId: anchor.threadId,
      anchorPosition: anchor.position,
    });

    const focusedRecord =
      window?.anchorIndex === null || window?.anchorIndex === undefined
        ? undefined
        : window.items[window.anchorIndex];
    if (
      anchor.mode === "FOCUS" &&
      (window === null || focusedRecord === undefined || focusedRecord.id !== anchor.commentId)
    ) {
      return this.toEmptyResponse(input.size);
    }

    if (window === null) {
      throw new ApplicationException(ErrorCode.SYS_0002);
    }

    const focusRecord = this.getFocusRecord(window.items, window.anchorIndex, anchor);
    const ancestorContext = await this.getFocusAncestors(input.todoId, focusRecord, window.items);
    const likedCommentIds = await this.#dependencies.reader.findLikedCommentIds(
      collectCommentIds([...window.items, ...ancestorContext.records]),
      input.viewerId,
    );
    const items = toTodoConversationItems({
      records: window.items,
      nextRecord: window.nextRecord,
      focusCommentId: focusRecord?.id ?? null,
      viewerId: input.viewerId,
      likedCommentIds,
    });
    const firstRecord = window.items.at(0);
    const lastRecord = window.items.at(-1);

    return {
      items,
      focus: this.toFocusResponse(
        focusRecord,
        window.anchorIndex,
        ancestorContext,
        input.viewerId,
        likedCommentIds,
      ),
      pagination: toTodoCommentCursorPagination({
        size: input.size,
        hasPrevious: window.hasPrevious,
        hasNext: window.hasNext,
        previousCursor:
          window.hasPrevious && firstRecord !== undefined
            ? this.#dependencies.cursorCodec.encodeConversation(
                firstRecord,
                input.sort,
                anchor.scope,
              )
            : null,
        nextCursor:
          window.hasNext && lastRecord !== undefined
            ? this.#dependencies.cursorCodec.encodeConversation(
                lastRecord,
                input.sort,
                anchor.scope,
              )
            : null,
      }),
    };
  }

  private getFocusRecord(
    items: readonly TodoCommentRecord[],
    anchorIndex: number | null,
    anchor: ConversationAnchor,
  ): TodoCommentRecord | null {
    if (anchor.mode !== "FOCUS") {
      return null;
    }

    const record = anchorIndex === null ? undefined : items[anchorIndex];

    if (record === undefined || record.id !== anchor.commentId) {
      throw new ApplicationException(ErrorCode.TODO_0831, { commentId: anchor.commentId });
    }

    return record.deletedAt === null ? record : null;
  }

  private toEmptyResponse(size: number): TodoConversationResponse {
    return {
      items: [],
      focus: null,
      pagination: toTodoCommentCursorPagination({
        size,
        hasPrevious: false,
        hasNext: false,
        previousCursor: null,
        nextCursor: null,
      }),
    };
  }

  private async getFocusAncestors(
    todoId: number,
    focusRecord: TodoCommentRecord | null,
    pageRecords: readonly TodoCommentRecord[],
  ): Promise<FocusAncestorContext> {
    if (focusRecord === null) {
      return { records: [], omittedCount: 0 };
    }

    const pageCommentIds = new Set(pageRecords.map((record) => record.id));
    const missingAncestorIds = focusRecord.path.filter(
      (commentId) => !pageCommentIds.has(commentId),
    );
    const requestedIds = missingAncestorIds.slice(-TODO_COMMENT_LIMITS.FOCUS_ANCESTOR_MAX_SIZE);
    const records = await this.#dependencies.reader.findAncestors(todoId, requestedIds);

    return {
      records,
      omittedCount: Math.max(0, missingAncestorIds.length - records.length),
    };
  }

  private toFocusResponse(
    focusRecord: TodoCommentRecord | null,
    itemIndex: number | null,
    ancestorContext: FocusAncestorContext,
    viewerId: string,
    likedCommentIds: ReadonlySet<string>,
  ): TodoConversationFocus | null {
    if (focusRecord === null || itemIndex === null) {
      return null;
    }

    return {
      commentId: focusRecord.id,
      itemIndex,
      precedingAncestors: toTodoConversationAncestorItems({
        records: ancestorContext.records,
        viewerId,
        likedCommentIds,
      }),
      omittedAncestorCount: ancestorContext.omittedCount,
    };
  }
}
