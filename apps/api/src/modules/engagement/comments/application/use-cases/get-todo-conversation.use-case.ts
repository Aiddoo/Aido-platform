import type { TodoCommentSort, TodoConversationFocus, TodoConversationResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import {
  toTodoConversationAncestorItems,
  toTodoConversationItems,
} from "../../presentation/http/v1/todo-comment-response.mapper.js";
import {
  collectCommentAuthorIds,
  collectCommentIds,
  toTodoCommentCursorPagination,
} from "../../presentation/http/v2/todo-comment-response.mapper.js";
import { assertTodoCommentAccess } from "../comments.errors.js";
import { type TodoCommentBlockReaderPort } from "../ports/todo-comment-block-reader.port.js";
import { type TodoCommentCursorCodecPort } from "../ports/todo-comment-cursor-codec.port.js";
import { type TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import type {
  ConversationPageMode,
  TodoCommentReadModel,
  TodoCommentRootPosition,
  TodoCommentViewer,
  TodoConversationCursor,
  TodoConversationScope,
} from "../read-models/todo-comment.read-model.js";

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
  readonly mode: ConversationPageMode;
  readonly scope: TodoConversationScope;
  readonly commentId?: string;
  readonly threadId?: string;
  readonly position?: TodoCommentRootPosition;
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
  input: GetTodoConversationQuery,
  cursorCodec: Pick<TodoCommentCursorCodecPort, "decodeConversation">,
): ConversationAnchor {
  if (input.focusCommentId != null) {
    return { mode: "FOCUS", scope: "THREAD", commentId: input.focusCommentId };
  }

  if (input.before != null) {
    const cursor = decodeCursor(input.before, input.sort, input.todoId, cursorCodec);
    return {
      mode: "BEFORE",
      scope: cursor.scope,
      commentId: cursor.commentId,
      threadId: cursor.threadId,
      position: cursor.position,
    };
  }

  if (input.after != null) {
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

interface GetTodoConversationDependencies {
  readonly reader: Pick<
    TodoCommentReaderPort,
    "findAccessibleTodoOwnerId" | "listConversation" | "findCommentRecords" | "findLikedCommentIds"
  >;
  readonly blockReader: Pick<TodoCommentBlockReaderPort, "findBlockedCounterpartIds">;
  readonly cursorCodec: Pick<
    TodoCommentCursorCodecPort,
    "decodeConversation" | "encodeConversation"
  >;
}

export class GetTodoConversationUseCase {
  readonly #dependencies: GetTodoConversationDependencies;

  constructor(dependencies: GetTodoConversationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoConversationQuery): Promise<TodoConversationResponse> {
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
      window?.anchorIndex == null ? undefined : window.items[window.anchorIndex];
    if (
      anchor.mode === "FOCUS" &&
      (window == null || focusedRecord == null || focusedRecord.id !== anchor.commentId)
    ) {
      return this.#toEmptyResponse(input.size);
    }

    if (window == null) {
      throw new ApplicationException(ErrorCode.SYS_0002);
    }

    const focusRecord = this.#getFocusRecord(window.items, window.anchorIndex, anchor);
    const precedingThreadComments = await this.#findPrecedingThreadComment(
      input.todoId,
      focusRecord,
      window.items,
    );
    const visibleRecords = [...window.items, ...precedingThreadComments];
    const [likedCommentIds, blockedAuthorIds] = await Promise.all([
      this.#dependencies.reader.findLikedCommentIds(
        collectCommentIds(visibleRecords),
        input.viewerId,
      ),
      this.#dependencies.blockReader.findBlockedCounterpartIds(
        input.viewerId,
        collectCommentAuthorIds(visibleRecords),
      ),
    ]);
    const viewer = { viewerId: input.viewerId, likedCommentIds, blockedAuthorIds };
    const items = toTodoConversationItems({
      records: window.items,
      nextRecord: window.nextRecord,
      focusCommentId: focusRecord?.id ?? null,
      viewer,
    });
    const firstRecord = window.items.at(0);
    const lastRecord = window.items.at(-1);

    return {
      items,
      focus: this.#toFocusResponse(
        focusRecord,
        window.anchorIndex,
        precedingThreadComments,
        viewer,
      ),
      pagination: toTodoCommentCursorPagination({
        size: input.size,
        hasPrevious: window.hasPrevious,
        hasNext: window.hasNext,
        previousCursor:
          window.hasPrevious && firstRecord != null
            ? this.#dependencies.cursorCodec.encodeConversation(
                firstRecord,
                input.sort,
                anchor.scope,
              )
            : null,
        nextCursor:
          window.hasNext && lastRecord != null
            ? this.#dependencies.cursorCodec.encodeConversation(
                lastRecord,
                input.sort,
                anchor.scope,
              )
            : null,
      }),
    };
  }

  #getFocusRecord(
    items: readonly TodoCommentReadModel[],
    anchorIndex: number | null,
    anchor: ConversationAnchor,
  ): TodoCommentReadModel | null {
    if (anchor.mode !== "FOCUS") {
      return null;
    }

    const record = anchorIndex == null ? undefined : items[anchorIndex];

    if (record == null || record.id !== anchor.commentId) {
      throw new ApplicationException(ErrorCode.TODO_0831, { commentId: anchor.commentId });
    }

    return record;
  }

  #toEmptyResponse(size: number): TodoConversationResponse {
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

  /** 1.14.0 이하 앱은 focus 답글 앞에 묶음 머리가 보여야 대화를 이어 그린다. */
  async #findPrecedingThreadComment(
    todoId: number,
    focusRecord: TodoCommentReadModel | null,
    pageRecords: readonly TodoCommentReadModel[],
  ): Promise<TodoCommentReadModel[]> {
    const threadCommentId = focusRecord?.threadCommentId;
    if (threadCommentId == null || pageRecords.some((record) => record.id === threadCommentId)) {
      return [];
    }

    return this.#dependencies.reader.findCommentRecords(todoId, [threadCommentId]);
  }

  #toFocusResponse(
    focusRecord: TodoCommentReadModel | null,
    itemIndex: number | null,
    precedingThreadComments: readonly TodoCommentReadModel[],
    viewer: TodoCommentViewer,
  ): TodoConversationFocus | null {
    if (focusRecord == null || itemIndex == null) {
      return null;
    }

    return {
      commentId: focusRecord.id,
      itemIndex,
      precedingAncestors: toTodoConversationAncestorItems({
        records: precedingThreadComments,
        viewer,
      }),
      omittedAncestorCount: 0,
    };
  }
}
