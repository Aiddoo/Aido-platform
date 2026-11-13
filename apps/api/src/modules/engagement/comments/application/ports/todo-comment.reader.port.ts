import type { TodoCommentSort } from "@aido/api/vocabulary";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import type {
  TodoCommentReadModel,
  TodoCommentRootPosition,
  TodoCommentThreadItemReadModel,
  TodoCommentWindow,
  TodoConversationWindow,
  TodoDetailsReadModel,
} from "../read-models/todo-comment.read-model.js";
import type {
  TodoCommentReplyPageMode,
  TodoCommentThreadPageMode,
  TodoConversationPageMode,
  TodoConversationScope,
} from "../todo-comment-page.constants.js";

export interface ListTodoCommentThreadsParams {
  readonly todoId: TodoId;
  readonly sort: TodoCommentSort;
  readonly size: number;
  readonly mode: TodoCommentThreadPageMode;
  readonly anchorCommentId?: TodoCommentId;
  /** cursor에 담긴 인기 점수. 없으면 기준 행의 현재 값을 쓴다 */
  readonly anchorPosition?: TodoCommentRootPosition;
}

export interface ListTodoCommentRepliesParams {
  readonly todoId: TodoId;
  readonly threadCommentId: TodoCommentId;
  readonly size: number;
  readonly mode: TodoCommentReplyPageMode;
  readonly anchorReplyId?: TodoCommentId;
}

export interface ListTodoConversationParams {
  readonly todoId: TodoId;
  readonly sort: TodoCommentSort;
  readonly size: number;
  readonly mode: TodoConversationPageMode;
  readonly scope: TodoConversationScope;
  readonly anchorCommentId?: TodoCommentId;
  readonly anchorThreadId?: TodoCommentId;
  readonly anchorPosition?: TodoCommentRootPosition;
}

/** 댓글 조회의 단일 경계. 쓰기 Aggregate와 응답용 조회 결과를 섞지 않는다 */
export abstract class TodoCommentReaderPort {
  abstract findAccessibleTodoDetails(
    todoId: TodoId,
    viewerId: UserId,
  ): Promise<TodoDetailsReadModel | null>;
  /** viewer가 볼 수 있는 할 일이면 주인 ID, 없거나 볼 수 없으면 null */
  abstract findAccessibleTodoOwnerId(todoId: TodoId, viewerId: UserId): Promise<string | null>;
  abstract findComment(
    todoId: TodoId,
    commentId: TodoCommentId,
  ): Promise<TodoCommentReadModel | null>;
  /** 요청한 id 순서대로 찾은 글만 돌려준다 */
  abstract listComments(
    todoId: TodoId,
    commentIds: readonly TodoCommentId[],
  ): Promise<TodoCommentReadModel[]>;
  /** 기준 묶음을 찾지 못하면 null */
  abstract listThreads(
    params: ListTodoCommentThreadsParams,
  ): Promise<TodoCommentWindow<TodoCommentThreadItemReadModel> | null>;
  /** 기준 답글을 찾지 못하면 null */
  abstract listReplies(
    params: ListTodoCommentRepliesParams,
  ): Promise<TodoCommentWindow<TodoCommentReadModel> | null>;
  /** 기준 글을 찾지 못하면 null */
  abstract listConversation(
    params: ListTodoConversationParams,
  ): Promise<TodoConversationWindow | null>;
  abstract listLikedCommentIds(
    commentIds: readonly TodoCommentId[],
    viewerId: UserId,
  ): Promise<ReadonlySet<string>>;
  /** 이름이 없으면 Aido ID(userTag)다. 사용자가 없으면 null이다 */
  abstract findUserDisplayName(userId: UserId): Promise<string | null>;
}
