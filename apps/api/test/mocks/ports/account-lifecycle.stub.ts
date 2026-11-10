import type {
  AccountNotificationCleanupPort,
  AccountNotificationCleanupResult,
  AccountTodoCommentCleanupPort,
  AccountTodoCommentCleanupResult,
  AccountUsageCleanupPort,
} from "#api/modules/identity/auth/application/ports/account-cleanup.port";
import type { AuthCachePort } from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import type { AuthPasswordHasherPort } from "#api/modules/identity/auth/application/ports/auth-crypto.port";
import type {
  AuthAccountRecord,
  AuthAccountRepositoryPort,
  AuthUserRecord,
  AuthUserRepositoryPort,
} from "#api/modules/identity/auth/application/ports/auth-persistence.port";
import { IdentityAccounts } from "#api/modules/identity/auth/domain/identity-accounts.aggregate";
import { IdentityUser } from "#api/modules/identity/auth/domain/identity-user.aggregate";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";
import { AccountFixture } from "#test/fixtures/user.fixture";

import { StubAuthSessionCache } from "./auth-session.stub.js";

/** 테스트 사용자 기록(Date)을 저장소가 돌려주는 Aggregate로 바꾼다 */
export function toIdentityUser(record: AuthUserRecord): IdentityUser {
  return IdentityUser.reconstitute({
    ...record,
    emailVerifiedAt:
      record.emailVerifiedAt == null ? null : instantFromDate(record.emailVerifiedAt),
    subscriptionExpiresAt:
      record.subscriptionExpiresAt == null ? null : instantFromDate(record.subscriptionExpiresAt),
    createdAt: instantFromDate(record.createdAt),
    deletedAt: record.deletedAt == null ? null : instantFromDate(record.deletedAt),
  });
}

export class StubAccountLifecycleRepository implements Pick<
  AuthUserRepositoryPort,
  "findById" | "findByIdForUpdate" | "saveAccountStatus" | "listPurgeEligible" | "hardDelete"
> {
  readonly users: Map<string, AuthUserRecord>;
  candidateSnapshot: IdentityUser[] | null = null;

  constructor(users: readonly AuthUserRecord[] = []) {
    this.users = new Map(users.map((user) => [user.id, { ...user }]));
  }

  async findById(id: string): Promise<IdentityUser | null> {
    const user = this.users.get(id);
    return user == null ? null : toIdentityUser(user);
  }

  async findByIdForUpdate(id: string): Promise<IdentityUser | null> {
    return this.findById(id);
  }

  async saveAccountStatus(user: IdentityUser): Promise<void> {
    const stored = this.#requireUser(user.id.value);
    const { status, deletedAt } = user.toPrimitives();
    this.users.set(stored.id, {
      ...stored,
      status,
      deletedAt: deletedAt == null ? null : instantToDate(deletedAt),
    });
  }

  async listPurgeEligible(now: Temporal.Instant): Promise<IdentityUser[]> {
    if (this.candidateSnapshot !== null) {
      return this.candidateSnapshot;
    }
    return [...this.users.values()]
      .map(toIdentityUser)
      .filter((user) => user.isPurgeEligibleAt(now));
  }

  /** 시나리오 준비용: 탈퇴 대기 상태로 둔다 */
  async softDelete(id: string, deletedAt = new Date()): Promise<void> {
    const user = this.#requireUser(id);
    this.users.set(id, { ...user, status: "SUSPENDED", deletedAt: new Date(deletedAt) });
  }

  /** 시나리오 준비용: 탈퇴를 되돌린다 */
  async restore(id: string): Promise<void> {
    const user = this.#requireUser(id);
    this.users.set(id, { ...user, status: "ACTIVE", deletedAt: null });
  }

  async hardDelete(id: string): Promise<void> {
    this.#requireUser(id);
    this.users.delete(id);
  }

  #requireUser(id: string): AuthUserRecord {
    const user = this.users.get(id);
    if (user === undefined) {
      throw new Error(`존재하지 않는 사용자: ${id}`);
    }
    return user;
  }
}

export class StubAccountRepository implements Pick<
  AuthAccountRepositoryPort,
  | "findAllByUserId"
  | "findIdentityAccounts"
  | "findByUserIdAndProvider"
  | "findByProviderAccountId"
  | "deleteAccount"
  | "createCredentialAccount"
  | "createOAuthAccount"
  | "updatePassword"
  | "updatePasswordIfUnchanged"
> {
  readonly accounts: AuthAccountRecord[];

  constructor(accounts: readonly AuthAccountRecord[] = []) {
    this.accounts = accounts.map((account) => ({ ...account }));
  }

  async findIdentityAccounts(userId: string): Promise<IdentityAccounts> {
    const accounts = await this.findAllByUserId(userId);
    return IdentityAccounts.reconstitute({
      userId,
      accounts: accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        createdAt: instantFromDate(account.createdAt),
      })),
    });
  }

  async findAllByUserId(userId: string): Promise<AuthAccountRecord[]> {
    return this.accounts.filter((account) => account.userId === userId);
  }

  async findByUserIdAndProvider(
    userId: string,
    provider: AuthAccountRecord["provider"],
  ): Promise<AuthAccountRecord | null> {
    const account = this.accounts.find(
      (account) => account.userId === userId && account.provider === provider,
    );
    return account === undefined ? null : { ...account };
  }

  async findByProviderAccountId(
    provider: AuthAccountRecord["provider"],
    providerAccountId: string,
  ): Promise<AuthAccountRecord | null> {
    const account = this.accounts.find(
      (account) => account.provider === provider && account.providerAccountId === providerAccountId,
    );
    return account === undefined ? null : { ...account };
  }

  async deleteAccount(userId: string, provider: AuthAccountRecord["provider"]): Promise<void> {
    const index = this.accounts.findIndex(
      (account) => account.userId === userId && account.provider === provider,
    );
    if (index !== -1) {
      this.accounts.splice(index, 1);
    }
  }

  async createCredentialAccount(userId: string, password: string): Promise<void> {
    this.accounts.push(AccountFixture.create({ userId, provider: "CREDENTIAL", password }));
  }

  async createOAuthAccount(
    input: Parameters<AuthAccountRepositoryPort["createOAuthAccount"]>[0],
  ): Promise<void> {
    this.accounts.push(
      AccountFixture.create({
        userId: input.userId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        password: null,
      }),
    );
  }

  async updatePassword(userId: string, password: string): Promise<void> {
    const account = this.accounts.find(
      (account) => account.userId === userId && account.provider === "CREDENTIAL",
    );
    if (account === undefined) {
      throw new Error(`Credential 계정이 없습니다: ${userId}`);
    }
    account.password = password;
  }

  async updatePasswordIfUnchanged(
    userId: string,
    expectedPasswordHash: string,
    passwordHash: string,
  ): Promise<boolean> {
    const account = this.accounts.find(
      (account) => account.userId === userId && account.provider === "CREDENTIAL",
    );
    if (account === undefined || account.password !== expectedPasswordHash) {
      return false;
    }
    account.password = passwordHash;
    return true;
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

export class StubAccountUsageCleanup implements AccountUsageCleanupPort {
  readonly cleanedUserIds: string[] = [];

  async cleanupInTransaction(userId: string): Promise<void> {
    this.cleanedUserIds.push(userId);
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
