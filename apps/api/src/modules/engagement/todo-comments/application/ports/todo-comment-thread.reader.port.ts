import type { TodoCommentSort } from "@aido/api/vocabulary";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";

import type { TodoCommentId } from "../../../shared/domain/todo-comment-id.vo.js";
import type {
  TodoCommentRootPositionReadModel,
  TodoCommentThreadItemReadModel,
  TodoCommentWindowReadModel,
} from "../read-models/todo-comment.read-model.js";
import type { TodoCommentThreadPageMode } from "../todo-comment-page.constants.js";

export interface ListTodoCommentThreadsParams {
  readonly todoId: TodoId;
  readonly sort: TodoCommentSort;
  readonly size: number;
  readonly mode: TodoCommentThreadPageMode;
  readonly anchorCommentId?: TodoCommentId;
  /** cursor에 담긴 인기 점수. 없으면 기준 행의 현재 값을 쓴다 */
  readonly anchorPosition?: TodoCommentRootPositionReadModel;
}

/** 묶음 머리 댓글을 최신·인기순으로 읽고 묶음마다 대표 답글과 참여자를 붙인다 */
export abstract class TodoCommentThreadReaderPort {
  /** 기준 묶음을 찾지 못하면 null */
  abstract listThreads(
    params: ListTodoCommentThreadsParams,
  ): Promise<TodoCommentWindowReadModel<TodoCommentThreadItemReadModel> | null>;
}
