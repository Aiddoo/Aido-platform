import type {
  ListTodoCommentRepliesParams,
  ListTodoCommentThreadsParams,
  ListTodoConversationParams,
  TodoCommentRecord,
  TodoCommentThreadItemRecord,
  TodoCommentWindow,
  TodoConversationWindow,
  TodoDetailsRecord,
} from "../read-models/todo-comment.read-model.js";

export const TODO_COMMENT_READER = Symbol("TODO_COMMENT_READER");

/** 댓글 읽기 모델의 단일 경계. 쓰기 aggregate와 응답 projection을 섞지 않는다. */
export interface TodoCommentReaderPort {
  findAccessibleTodoDetails(todoId: number, viewerId: string): Promise<TodoDetailsRecord | null>;
  /** viewer가 볼 수 있는 할 일이면 주인 ID, 없거나 볼 수 없으면 null */
  findAccessibleTodoOwnerId(todoId: number, viewerId: string): Promise<string | null>;
  findCommentRecord(todoId: number, commentId: string): Promise<TodoCommentRecord | null>;
  findCommentRecords(todoId: number, commentIds: readonly string[]): Promise<TodoCommentRecord[]>;
  /** 기준 묶음을 찾지 못하면 null */
  listThreads(
    params: ListTodoCommentThreadsParams,
  ): Promise<TodoCommentWindow<TodoCommentThreadItemRecord> | null>;
  /** 기준 답글을 찾지 못하면 null */
  listReplies(
    params: ListTodoCommentRepliesParams,
  ): Promise<TodoCommentWindow<TodoCommentRecord> | null>;
  listConversation(params: ListTodoConversationParams): Promise<TodoConversationWindow | null>;
  findLikedCommentIds(commentIds: readonly string[], viewerId: string): Promise<Set<string>>;
  findUserDisplayName(userId: string): Promise<string | null>;
}
