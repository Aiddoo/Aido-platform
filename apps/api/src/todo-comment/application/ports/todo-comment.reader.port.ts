import type {
	ListTodoCommentOverviewParams,
	ListTodoConversationParams,
	TodoCommentRecord,
	TodoCommentOverviewWindow,
	TodoConversationWindow,
	TodoDetailsRecord,
} from "../types";

export const TODO_COMMENT_READER = Symbol("TODO_COMMENT_READER");

/** 댓글 읽기 모델의 단일 경계. 쓰기 aggregate와 응답 projection을 섞지 않는다. */
export interface TodoCommentReaderPort {
	findAccessibleTodoDetails(todoId: number, viewerId: string): Promise<TodoDetailsRecord | null>;
	canAccessTodo(todoId: number, viewerId: string): Promise<boolean>;
	findCommentRecord(todoId: number, commentId: string): Promise<TodoCommentRecord | null>;
	findCommentRecords(todoId: number, commentIds: readonly string[]): Promise<TodoCommentRecord[]>;
	listOverview(params: ListTodoCommentOverviewParams): Promise<TodoCommentOverviewWindow | null>;
	listConversation(params: ListTodoConversationParams): Promise<TodoConversationWindow | null>;
	/** 뿌리 → 부모 순서의 조상. path가 비면 빈 배열을 돌려준다. */
	findAncestors(todoId: number, path: readonly string[]): Promise<TodoCommentRecord[]>;
	findLikedCommentIds(commentIds: readonly string[], viewerId: string): Promise<Set<string>>;
	findUserDisplayName(userId: string): Promise<string | null>;
}
