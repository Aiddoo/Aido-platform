import type { TodoCommentSort } from "@aido/api/vocabulary";

import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";

import type { TodoCommentId } from "../../../shared/domain/todo-comment-id.vo.js";
import type {
  TodoCommentRootPositionReadModel,
  TodoConversationWindowReadModel,
} from "../read-models/todo-comment.read-model.js";
import type {
  TodoConversationPageMode,
  TodoConversationScope,
} from "../todo-comment-page.constants.js";

export interface ListTodoConversationParams {
  readonly todoId: TodoId;
  readonly sort: TodoCommentSort;
  readonly size: number;
  readonly mode: TodoConversationPageMode;
  readonly scope: TodoConversationScope;
  readonly anchorCommentId?: TodoCommentId;
  readonly anchorThreadId?: TodoCommentId;
  readonly anchorPosition?: TodoCommentRootPositionReadModel;
}

/** 1.14.0 이하 앱의 대화. 묶음 순서대로, 묶음 안은 머리 다음 답글을 작성 순으로 펼쳐 읽는다 */
export abstract class TodoConversationReaderPort {
  /** 기준 글을 찾지 못하면 null */
  abstract listConversation(
    params: ListTodoConversationParams,
  ): Promise<TodoConversationWindowReadModel | null>;
}
