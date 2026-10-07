import type { TodoCommentOverviewResponse, TodoCommentSort } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/index";

import type {
  OverviewPageMode,
  TodoCommentOverviewCursor,
  TodoCommentRootPosition,
} from "../../models/comments/todo-comment.types.js";
import { type TodoCommentCursorCodecPort } from "../../ports/comments/todo-comment-cursor-codec.port.js";
import { type TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";
import {
  toTodoCommentCursorPagination,
  toTodoCommentOverviewItem,
} from "../../presenters/comments/index.js";
import { assertTodoCommentAccess } from "../../services/comments/assert-todo-comment-access.js";

export interface GetTodoCommentOverviewInput {
  readonly todoId: number;
  readonly viewerId: string;
  readonly sort: TodoCommentSort;
  readonly before?: string;
  readonly after?: string;
  readonly size: number;
}

interface OverviewAnchor {
  readonly mode: OverviewPageMode;
  readonly rootId?: string;
  readonly position?: TodoCommentRootPosition;
}

function decodeCursor(
  cursor: string,
  sort: TodoCommentSort,
  todoId: number,
  cursorCodec: Pick<TodoCommentCursorCodecPort, "decodeOverview">,
): TodoCommentOverviewCursor {
  const decoded = cursorCodec.decodeOverview(cursor, sort);

  if (decoded.todoId !== todoId) {
    throw new ApplicationException(ErrorCode.SYS_0002);
  }

  return decoded;
}

function getAnchor(
  input: GetTodoCommentOverviewInput,
  cursorCodec: Pick<TodoCommentCursorCodecPort, "decodeOverview">,
): OverviewAnchor {
  if (input.before !== undefined) {
    const cursor = decodeCursor(input.before, input.sort, input.todoId, cursorCodec);
    return { mode: "BEFORE", rootId: cursor.rootId, position: cursor.position };
  }

  if (input.after !== undefined) {
    const cursor = decodeCursor(input.after, input.sort, input.todoId, cursorCodec);
    return { mode: "AFTER", rootId: cursor.rootId, position: cursor.position };
  }

  return { mode: "INITIAL" };
}

interface GetTodoCommentOverviewDependencies {
  readonly reader: Pick<
    TodoCommentReaderPort,
    "canAccessTodo" | "listOverview" | "findLikedCommentIds"
  >;
  readonly cursorCodec: Pick<TodoCommentCursorCodecPort, "decodeOverview" | "encodeOverview">;
}

export class GetTodoCommentOverview {
  readonly #dependencies: GetTodoCommentOverviewDependencies;

  constructor(dependencies: GetTodoCommentOverviewDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoCommentOverviewInput): Promise<TodoCommentOverviewResponse> {
    await assertTodoCommentAccess(this.#dependencies.reader, input.todoId, input.viewerId);
    const anchor = getAnchor(input, this.#dependencies.cursorCodec);
    const window = await this.#dependencies.reader.listOverview({
      todoId: input.todoId,
      sort: input.sort,
      size: input.size,
      mode: anchor.mode,
      anchorRootId: anchor.rootId,
      anchorPosition: anchor.position,
    });

    if (window === null) {
      throw new ApplicationException(ErrorCode.SYS_0002);
    }

    const commentIds = window.items.flatMap((item) => [
      item.comment.id,
      ...(item.previewReply === null ? [] : [item.previewReply.id]),
    ]);
    const likedCommentIds = await this.#dependencies.reader.findLikedCommentIds(
      commentIds,
      input.viewerId,
    );
    const firstRecord = window.items.at(0)?.comment;
    const lastRecord = window.items.at(-1)?.comment;

    return {
      items: window.items.map((record) =>
        toTodoCommentOverviewItem({ record, viewerId: input.viewerId, likedCommentIds }),
      ),
      pagination: toTodoCommentCursorPagination({
        size: input.size,
        hasPrevious: window.hasPrevious,
        hasNext: window.hasNext,
        previousCursor:
          window.hasPrevious && firstRecord !== undefined
            ? this.#dependencies.cursorCodec.encodeOverview(firstRecord, input.sort)
            : null,
        nextCursor:
          window.hasNext && lastRecord !== undefined
            ? this.#dependencies.cursorCodec.encodeOverview(lastRecord, input.sort)
            : null,
      }),
    };
  }
}
