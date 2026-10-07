export const ACCOUNT_NOTIFICATION_CLEANUP = Symbol("ACCOUNT_NOTIFICATION_CLEANUP");
export const ACCOUNT_TODO_COMMENT_CLEANUP = Symbol("ACCOUNT_TODO_COMMENT_CLEANUP");

export interface AccountNotificationCleanupResult {
  affectedUserIds: string[];
}

export interface AccountNotificationCleanupPort {
  cleanupInTransaction(userId: string): Promise<AccountNotificationCleanupResult>;
  settleAfterCommit(result: AccountNotificationCleanupResult): Promise<void>;
}

export interface AccountTodoCommentCleanupResult {
  readonly affectedTodoIds: readonly number[];
}

export interface AccountTodoCommentCleanupPort {
  cleanupInTransaction(userId: string): Promise<AccountTodoCommentCleanupResult>;
  settleAfterCommit(result: AccountTodoCommentCleanupResult): Promise<void>;
}
