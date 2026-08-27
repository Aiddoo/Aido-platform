export const TODO_COMMENT_ACCOUNT_CLEANUP_STORE = Symbol("TODO_COMMENT_ACCOUNT_CLEANUP_STORE");

export interface TodoCommentAccountCleanupPlan {
	readonly affectedTodoIds: readonly number[];
	readonly commentIdsToLock: readonly string[];
}

/** 계정 hard delete 전에 댓글 도메인이 소유한 데이터와 비정규화 counter를 함께 정리한다. */
export interface TodoCommentAccountCleanupStorePort {
	plan(userId: string): Promise<TodoCommentAccountCleanupPlan>;
	cleanup(userId: string, plan: TodoCommentAccountCleanupPlan): Promise<void>;
}
