export interface AccountNotificationCleanupResult {
  affectedUserIds: string[];
}

export abstract class AccountNotificationCleanupPort {
  abstract cleanupInTransaction(userId: string): Promise<AccountNotificationCleanupResult>;
  abstract settleAfterCommit(result: AccountNotificationCleanupResult): Promise<void>;
}

export interface AccountTodoCommentCleanupResult {
  readonly affectedTodoIds: readonly number[];
}

export abstract class AccountTodoCommentCleanupPort {
  abstract cleanupInTransaction(userId: string): Promise<AccountTodoCommentCleanupResult>;
  abstract settleAfterCommit(result: AccountTodoCommentCleanupResult): Promise<void>;
}

/** FK가 없는 외부 호출 사용량(OutboundUsage.subject)에 남은 사용자 id를 지운다. 커밋 뒤 할 일은 없다. */
export abstract class AccountUsageCleanupPort {
  abstract cleanupInTransaction(userId: string): Promise<void>;
}
