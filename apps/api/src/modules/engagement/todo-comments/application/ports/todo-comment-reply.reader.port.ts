import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";

import type { TodoCommentId } from "../../../shared/domain/todo-comment-id.vo.js";
import type {
  TodoCommentReadModel,
  TodoCommentWindowReadModel,
} from "../read-models/todo-comment.read-model.js";
import type { TodoCommentReplyPageMode } from "../todo-comment-page.constants.js";

export interface ListTodoCommentRepliesParams {
  readonly todoId: TodoId;
  readonly threadCommentId: TodoCommentId;
  readonly size: number;
  readonly mode: TodoCommentReplyPageMode;
  readonly anchorReplyId?: TodoCommentId;
}

/** 묶음 하나의 답글을 작성 순으로 읽는다 */
export abstract class TodoCommentReplyReaderPort {
  /** 기준 답글을 찾지 못하면 null */
  abstract listReplies(
    params: ListTodoCommentRepliesParams,
  ): Promise<TodoCommentWindowReadModel<TodoCommentReadModel> | null>;
}
