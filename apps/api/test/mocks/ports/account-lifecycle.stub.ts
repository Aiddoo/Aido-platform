import type {
  AccountNotificationCleanupPort,
  AccountNotificationCleanupResult,
  AccountTodoCommentCleanupPort,
  AccountTodoCommentCleanupResult,
} from "#api/modules/identity/application/ports/auth/account-cleanup.port";
import type { AuthCachePort } from "#api/modules/identity/application/ports/auth/auth-collaboration.port";
import type { AuthPasswordHasherPort } from "#api/modules/identity/application/ports/auth/auth-crypto.port";
import type {
  AuthAccountLifecycleRepositoryPort,
  AuthAccountRecord,
  AuthAccountRepositoryPort,
  AuthUserRecord,
  AuthUserRepositoryPort,
} from "#api/modules/identity/application/ports/auth/auth-persistence.port";

import { StubAuthSessionCache } from "./auth-session.stub.js";

type PurgeCandidate = Awaited<
  ReturnType<AuthAccountLifecycleRepositoryPort["findSoftDeletedForPurge"]>
>[number];

export class StubAccountLifecycleRepository
  implements
    AuthAccountLifecycleRepositoryPort,
    Pick<AuthUserRepositoryPort, "softDelete" | "restore">
{
  readonly users: Map<string, AuthUserRecord>;
  candidateSnapshot: PurgeCandidate[] | null = null;

  constructor(users: readonly AuthUserRecord[] = []) {
    this.users = new Map(users.map((user) => [user.id, { ...user }]));
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async findByIdForPurge(id: string): Promise<AuthUserRecord | null> {
    return this.findById(id);
  }

  async softDelete(id: string, deletedAt = new Date()): Promise<void> {
    const user = this.#requireUser(id);
    this.users.set(id, { ...user, status: "SUSPENDED", deletedAt: new Date(deletedAt) });
  }

  async restore(id: string): Promise<void> {
    const user = this.#requireUser(id);
    this.users.set(id, { ...user, status: "ACTIVE", deletedAt: null });
  }

  async findSoftDeletedForPurge(
    gracePeriodDays: number,
    at = new Date(),
  ): Promise<PurgeCandidate[]> {
    if (this.candidateSnapshot !== null) return this.candidateSnapshot;
    const cutoff = at.getTime() - gracePeriodDays * 86_400_000;
    const candidates: PurgeCandidate[] = [];
    for (const user of this.users.values()) {
      if (user.deletedAt !== null && user.deletedAt.getTime() < cutoff)
        candidates.push({ id: user.id, email: user.email, deletedAt: new Date(user.deletedAt) });
    }
    return candidates;
  }

  async hardDelete(id: string): Promise<void> {
    this.#requireUser(id);
    this.users.delete(id);
  }

  #requireUser(id: string): AuthUserRecord {
    const user = this.users.get(id);
    if (user === undefined) throw new Error(`존재하지 않는 사용자: ${id}`);
    return user;
  }
}

export class StubAccountRepository implements Pick<AuthAccountRepositoryPort, "findAllByUserId"> {
  constructor(readonly accounts: readonly AuthAccountRecord[] = []) {}

  async findAllByUserId(userId: string): Promise<AuthAccountRecord[]> {
    return this.accounts.filter((account) => account.userId === userId);
  }
}

export class StubAccountPasswordVerifier implements Pick<AuthPasswordHasherPort, "verify"> {
  readonly checked: { hash: string; password: string }[] = [];

  async verify(hash: string, password: string): Promise<boolean> {
    this.checked.push({ hash, password });
    return hash === `digest:${password}`;
  }
}

export class StubAccountLifecycleCache
  extends StubAuthSessionCache
  implements Pick<AuthCachePort, "invalidateSession" | "invalidateUserProfile">
{
  readonly userIds: Set<string>;

  constructor(sessionIds: readonly string[] = [], userIds: readonly string[] = []) {
    super(sessionIds);
    this.userIds = new Set(userIds);
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    this.userIds.delete(userId);
  }
}

export class StubAccountNotificationCleanup implements AccountNotificationCleanupPort {
  readonly cleanedUserIds: string[] = [];
  readonly settlements: AccountNotificationCleanupResult[] = [];

  async cleanupInTransaction(userId: string): Promise<AccountNotificationCleanupResult> {
    this.cleanedUserIds.push(userId);
    return { affectedUserIds: [userId] };
  }

  async settleAfterCommit(result: AccountNotificationCleanupResult): Promise<void> {
    this.settlements.push(result);
  }
}

export class StubAccountTodoCommentCleanup implements AccountTodoCommentCleanupPort {
  readonly cleanedUserIds: string[] = [];
  readonly settlements: AccountTodoCommentCleanupResult[] = [];

  async cleanupInTransaction(userId: string): Promise<AccountTodoCommentCleanupResult> {
    this.cleanedUserIds.push(userId);
    return { affectedTodoIds: [101] };
  }

  async settleAfterCommit(result: AccountTodoCommentCleanupResult): Promise<void> {
    this.settlements.push(result);
  }
}
