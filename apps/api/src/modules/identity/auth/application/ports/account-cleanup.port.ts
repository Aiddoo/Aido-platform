export const ACCOUNT_NOTIFICATION_CLEANUP = Symbol("ACCOUNT_NOTIFICATION_CLEANUP");
export const ACCOUNT_TODO_COMMENT_CLEANUP = Symbol("ACCOUNT_TODO_COMMENT_CLEANUP");
export const ACCOUNT_USAGE_CLEANUP = Symbol("ACCOUNT_USAGE_CLEANUP");

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

/** FK가 없는 외부 호출 사용량(OutboundUsage.subject)에 남은 사용자 id를 지운다. 커밋 뒤 할 일은 없다. */
export interface AccountUsageCleanupPort {
  cleanupInTransaction(userId: string): Promise<void>;
}
