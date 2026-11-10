export const TODO_COMMENT_ACCOUNT_CLEANUP = Symbol("TODO_COMMENT_ACCOUNT_CLEANUP");

export interface TodoCommentAccountCleanupResult {
  readonly affectedTodoIds: readonly number[];
}

export interface TodoCommentAccountCleanupPort {
  cleanupInTransaction(userId: string): Promise<TodoCommentAccountCleanupResult>;
  settleAfterCommit(result: TodoCommentAccountCleanupResult): Promise<void>;
}
