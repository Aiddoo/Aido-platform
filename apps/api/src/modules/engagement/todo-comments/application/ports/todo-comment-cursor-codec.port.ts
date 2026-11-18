import type { TodoCommentSort } from "@aido/api/vocabulary";

import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";

import type { TodoCommentId } from "../../../shared/domain/todo-comment-id.vo.js";
import type {
  TodoCommentReadModel,
  TodoCommentRootPositionReadModel,
  TodoCommentThreadReadModel,
  TodoConversationReadModel,
} from "../read-models/todo-comment.read-model.js";
import type {
  TodoCommentPageDirection,
  TodoConversationScope,
} from "../todo-comment-page.constants.js";

/** 대화 cursor는 화면에 드러나지 않는 정렬의 바뀌지 않는 행 위치를 가리킨다 */
export interface TodoConversationCursor {
  readonly sort: TodoCommentSort;
  readonly todoId: TodoId;
  readonly commentId: TodoCommentId;
  readonly threadId: TodoCommentId;
  readonly scope: TodoConversationScope;
  readonly position: TodoCommentRootPositionReadModel;
}

/** 방향이 없으면 1.14.0 이하 앱이 가진 cursor다 */
export interface TodoCommentThreadCursor {
  readonly sort: TodoCommentSort;
  readonly todoId: TodoId;
  readonly rootId: TodoCommentId;
  readonly position: TodoCommentRootPositionReadModel;
  readonly direction?: TodoCommentPageDirection;
}

export interface TodoCommentRepliesCursor {
  readonly todoId: TodoId;
  readonly threadCommentId: TodoCommentId;
  readonly replyId: TodoCommentId;
  readonly direction: TodoCommentPageDirection;
}

/**
 * 댓글 keyset 위치를 클라이언트가 조립하거나 바꿀 수 없는 불투명 cursor로 바꾼다.
 * 서명·직렬화 방식은 infrastructure가 소유하고, 잘못된 cursor는 SYS_0002로 거절한다.
 */
export abstract class TodoCommentCursorCodecPort {
  abstract decodeConversation(cursor: string, sort: TodoCommentSort): TodoConversationCursor;
  abstract encodeConversation(
    item: TodoConversationReadModel,
    sort: TodoCommentSort,
    scope: TodoConversationScope,
  ): string;
  abstract decodeThreads(cursor: string, sort: TodoCommentSort): TodoCommentThreadCursor;
  abstract encodeThreads(
    item: TodoCommentThreadReadModel,
    sort: TodoCommentSort,
    direction: TodoCommentPageDirection,
  ): string;
  abstract decodeReplies(cursor: string): TodoCommentRepliesCursor;
  abstract encodeReplies(item: TodoCommentReadModel, direction: TodoCommentPageDirection): string;
}
