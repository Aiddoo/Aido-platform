import type { PasswordHasherPort } from "#api/modules/identity/linked-accounts/application/ports/password-hasher.port";
import type { SessionCachePort } from "#api/modules/identity/sessions/application/ports/session-cache.port";
import type {
  AccountNotificationCleanupPort,
  AccountNotificationCleanupResult,
  AccountTodoCommentCleanupPort,
  AccountTodoCommentCleanupResult,
  AccountUsageCleanupPort,
} from "#api/modules/identity/users/application/ports/account-cleanup.port";
import type { UserProfileInvalidatorPort } from "#api/modules/identity/users/application/ports/user-profile-invalidator.port";
import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { StubSessionCache } from "#test/doubles/identity/stub-auth-session";

export class StubAccountPasswordVerifier implements Pick<PasswordHasherPort, "verify"> {
  readonly checked: { hash: string; password: string }[] = [];

  async verify(hash: string, password: string): Promise<boolean> {
    this.checked.push({ hash, password });
    return hash === `digest:${password}`;
  }
}

export class StubAccountLifecycleCache
  extends StubSessionCache
  implements Pick<SessionCachePort, "invalidateSession">, UserProfileInvalidatorPort
{
  readonly userIds: Set<string>;

  constructor(sessionIds: readonly string[] = [], userIds: readonly string[] = []) {
    super(sessionIds);
    this.userIds = new Set(userIds);
  }

  async invalidateUserProfile(userId: UserId): Promise<void> {
    this.userIds.delete(userId.value);
  }
}

export class StubAccountNotificationCleanup implements AccountNotificationCleanupPort {
  readonly cleanedUserIds: string[] = [];
  readonly settlements: { affectedUserIds: string[] }[] = [];

  async cleanupInTransaction(userId: UserId): Promise<AccountNotificationCleanupResult> {
    this.cleanedUserIds.push(userId.value);
    return { affectedUserIds: [userId] };
  }

  async settleAfterCommit(result: AccountNotificationCleanupResult): Promise<void> {
    this.settlements.push({ affectedUserIds: result.affectedUserIds.map((user) => user.value) });
  }
}

export class StubAccountUsageCleanup implements AccountUsageCleanupPort {
  readonly cleanedUserIds: string[] = [];

  async cleanupInTransaction(userId: UserId): Promise<void> {
    this.cleanedUserIds.push(userId.value);
  }
}

export class StubAccountTodoCommentCleanup implements AccountTodoCommentCleanupPort {
  readonly cleanedUserIds: string[] = [];
  readonly settlements: { affectedTodoIds: number[] }[] = [];

  async cleanupInTransaction(userId: UserId): Promise<AccountTodoCommentCleanupResult> {
    this.cleanedUserIds.push(userId.value);
    return { affectedTodoIds: [TodoId.reconstitute(101)] };
  }

  async settleAfterCommit(result: AccountTodoCommentCleanupResult): Promise<void> {
    this.settlements.push({ affectedTodoIds: result.affectedTodoIds.map((todo) => todo.value) });
  }
}
