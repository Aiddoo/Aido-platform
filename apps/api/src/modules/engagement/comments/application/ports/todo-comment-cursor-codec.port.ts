import type { TodoCommentSort } from "@aido/api/vocabulary";

import type {
  TodoCommentPageDirection,
  TodoCommentRecord,
  TodoCommentRepliesCursor,
  TodoCommentThreadCursor,
  TodoCommentThreadRecord,
  TodoConversationCursor,
  TodoConversationRecord,
  TodoConversationScope,
} from "../read-models/todo-comment.read-model.js";

export const TODO_COMMENT_CURSOR_CODEC = Symbol("TODO_COMMENT_CURSOR_CODEC");

/**
 * 댓글 keyset 위치를 클라이언트가 조립하거나 변경할 수 없는 opaque cursor로 바꾼다.
 * 암호화와 직렬화 방식은 infrastructure가 소유한다.
 */
export interface TodoCommentCursorCodecPort {
  decodeConversation(cursor: string, sort: TodoCommentSort): TodoConversationCursor;
  encodeConversation(
    record: TodoConversationRecord,
    sort: TodoCommentSort,
    scope?: TodoConversationScope,
  ): string;
  decodeThreads(cursor: string, sort: TodoCommentSort): TodoCommentThreadCursor;
  encodeThreads(
    record: TodoCommentThreadRecord,
    sort: TodoCommentSort,
    direction: TodoCommentPageDirection,
  ): string;
  decodeReplies(cursor: string): TodoCommentRepliesCursor;
  encodeReplies(record: TodoCommentRecord, direction: TodoCommentPageDirection): string;
}
