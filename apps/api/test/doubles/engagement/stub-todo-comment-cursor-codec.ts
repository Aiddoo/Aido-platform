import type { TodoCommentSort } from "@aido/api/vocabulary";

import { invalidCommentRequest } from "#api/modules/engagement/comments/application/comments.errors";
import {
  TodoCommentCursorCodecPort,
  type TodoCommentRepliesCursor,
  type TodoCommentThreadCursor,
  type TodoConversationCursor,
} from "#api/modules/engagement/comments/application/ports/todo-comment-cursor-codec.port";
import type {
  TodoCommentReadModel,
  TodoConversationReadModel,
} from "#api/modules/engagement/comments/application/read-models/todo-comment.read-model";
import type {
  TodoCommentPageDirection,
  TodoConversationScope,
} from "#api/modules/engagement/comments/application/todo-comment-page.constants";

/** 읽은 cursor는 테스트가 정하고, 만든 cursor는 무엇을 담았는지 읽을 수 있는 문자열로 돌려준다 */
export class StubTodoCommentCursorCodec extends TodoCommentCursorCodecPort {
  readonly #cursors = new Map<
    string,
    TodoConversationCursor | TodoCommentThreadCursor | TodoCommentRepliesCursor
  >();

  register(
    cursor: string,
    decoded: TodoConversationCursor | TodoCommentThreadCursor | TodoCommentRepliesCursor,
  ): void {
    this.#cursors.set(cursor, decoded);
  }

  decodeConversation(cursor: string, _sort: TodoCommentSort): TodoConversationCursor {
    const decoded = this.#cursors.get(cursor);
    if (decoded == null || !("scope" in decoded)) {
      throw invalidCommentRequest();
    }
    return decoded;
  }

  encodeConversation(
    item: TodoConversationReadModel,
    sort: TodoCommentSort,
    scope: TodoConversationScope,
  ): string {
    return `conversation:${sort}:${scope}:${item.id}`;
  }

  decodeThreads(cursor: string, _sort: TodoCommentSort): TodoCommentThreadCursor {
    const decoded = this.#cursors.get(cursor);
    if (decoded == null || !("rootId" in decoded)) {
      throw invalidCommentRequest();
    }
    return decoded;
  }

  encodeThreads(
    item: TodoCommentReadModel,
    sort: TodoCommentSort,
    direction: TodoCommentPageDirection,
  ): string {
    return `threads:${sort}:${direction}:${item.id}`;
  }

  decodeReplies(cursor: string): TodoCommentRepliesCursor {
    const decoded = this.#cursors.get(cursor);
    if (decoded == null || !("replyId" in decoded)) {
      throw invalidCommentRequest();
    }
    return decoded;
  }

  encodeReplies(item: TodoCommentReadModel, direction: TodoCommentPageDirection): string {
    return `replies:${direction}:${item.id}`;
  }
}
