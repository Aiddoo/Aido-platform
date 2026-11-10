import type {
  ListTodoCommentRepliesParams,
  ListTodoCommentThreadsParams,
  ListTodoConversationParams,
  TodoCommentReadModel,
  TodoCommentThreadItemReadModel,
  TodoCommentWindow,
  TodoConversationWindow,
  TodoDetailsReadModel,
} from "../read-models/todo-comment.read-model.js";

export const TODO_COMMENT_READER = Symbol("TODO_COMMENT_READER");

/** 댓글 읽기 모델의 단일 경계. 쓰기 aggregate와 응답 projection을 섞지 않는다. */
export interface TodoCommentReaderPort {
  findAccessibleTodoDetails(todoId: number, viewerId: string): Promise<TodoDetailsReadModel | null>;
  /** viewer가 볼 수 있는 할 일이면 주인 ID, 없거나 볼 수 없으면 null */
  findAccessibleTodoOwnerId(todoId: number, viewerId: string): Promise<string | null>;
  findCommentRecord(todoId: number, commentId: string): Promise<TodoCommentReadModel | null>;
  findCommentRecords(
    todoId: number,
    commentIds: readonly string[],
  ): Promise<TodoCommentReadModel[]>;
  /** 기준 묶음을 찾지 못하면 null */
  listThreads(
    params: ListTodoCommentThreadsParams,
  ): Promise<TodoCommentWindow<TodoCommentThreadItemReadModel> | null>;
  /** 기준 답글을 찾지 못하면 null */
  listReplies(
    params: ListTodoCommentRepliesParams,
  ): Promise<TodoCommentWindow<TodoCommentReadModel> | null>;
  listConversation(params: ListTodoConversationParams): Promise<TodoConversationWindow | null>;
  findLikedCommentIds(commentIds: readonly string[], viewerId: string): Promise<Set<string>>;
  findUserDisplayName(userId: string): Promise<string | null>;
}
