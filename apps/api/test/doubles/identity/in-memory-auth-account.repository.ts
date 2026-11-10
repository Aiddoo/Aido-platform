import {
  accountAlreadyExists,
  AuthPersistenceConflict,
} from "#api/modules/identity/auth/application/auth.errors";
import {
  type AuthAccountRecord,
  AuthAccountRepositoryPort,
  type NewOAuthAccount,
} from "#api/modules/identity/auth/application/ports/auth-account.repository.port";
import type { AccountProvider } from "#api/modules/identity/auth/domain/auth.constants";
import { IdentityAccounts } from "#api/modules/identity/auth/domain/identity-accounts.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export const IN_MEMORY_ACCOUNT_CREATED_AT = Temporal.Instant.from("2026-11-10T00:00:00Z");

export class InMemoryAuthAccountRepository extends AuthAccountRepositoryPort {
  readonly #accounts = new Map<number, AuthAccountRecord>();
  #sequence: number;

  constructor(accounts: readonly AuthAccountRecord[] = []) {
    super();
    for (const account of accounts) {
      this.#accounts.set(account.id, account);
    }
    this.#sequence = Math.max(0, ...this.#accounts.keys());
  }

  get all(): readonly AuthAccountRecord[] {
    return [...this.#accounts.values()].toSorted((left, right) => left.id - right.id);
  }

  async findByUserIdAndProvider(
    userId: UserId,
    provider: AccountProvider,
  ): Promise<AuthAccountRecord | null> {
    return (
      this.all.find(
        (account) => account.userId === userId.value && account.provider === provider,
      ) ?? null
    );
  }

  async findByProviderAccountId(
    provider: AccountProvider,
    providerAccountId: string,
  ): Promise<AuthAccountRecord | null> {
    return (
      this.all.find(
        (account) =>
          account.provider === provider && account.providerAccountId === providerAccountId,
      ) ?? null
    );
  }

  async findAllByUserId(userId: UserId): Promise<AuthAccountRecord[]> {
    return this.all.filter((account) => account.userId === userId.value);
  }

  async findIdentityAccounts(userId: UserId): Promise<IdentityAccounts> {
    return IdentityAccounts.reconstitute({
      userId: userId.value,
      accounts: (await this.findAllByUserId(userId)).map((account) => ({
        id: account.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        createdAt: account.createdAt,
      })),
    });
  }

  async createCredentialAccount(userId: UserId, hashedPassword: string): Promise<void> {
    if (this.#isTaken(userId.value, "CREDENTIAL", userId.value)) {
      throw accountAlreadyExists();
    }
    this.#insert({
      userId: userId.value,
      provider: "CREDENTIAL",
      providerAccountId: userId.value,
      password: hashedPassword,
    });
  }

  async updatePassword(userId: UserId, hashedPassword: string): Promise<void> {
    const account = await this.findByUserIdAndProvider(userId, "CREDENTIAL");
    if (account != null) {
      this.#accounts.set(account.id, { ...account, password: hashedPassword });
    }
  }

  async updatePasswordIfUnchanged(
    userId: UserId,
    expectedPasswordHash: string,
    passwordHash: string,
  ): Promise<boolean> {
    const account = await this.findByUserIdAndProvider(userId, "CREDENTIAL");
    if (account == null || account.password !== expectedPasswordHash) {
      return false;
    }
    this.#accounts.set(account.id, { ...account, password: passwordHash });
    return true;
  }

  async createOAuthAccount(account: NewOAuthAccount): Promise<void> {
    if (this.#isTaken(account.userId.value, account.provider, account.providerAccountId)) {
      throw new AuthPersistenceConflict("OAUTH_ACCOUNT_ALREADY_LINKED");
    }
    this.#insert({
      userId: account.userId.value,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      password: null,
    });
  }

  async deleteAccount(userId: UserId, provider: AccountProvider): Promise<void> {
    const account = await this.findByUserIdAndProvider(userId, provider);
    if (account != null) {
      this.#accounts.delete(account.id);
    }
  }

  // Account_userId_provider_key·Account_provider_providerAccountId_key 두 유일 제약과 같다
  #isTaken(userId: string, provider: AccountProvider, providerAccountId: string): boolean {
    return this.all.some(
      (account) =>
        account.provider === provider &&
        (account.userId === userId || account.providerAccountId === providerAccountId),
    );
  }

  #insert(account: Omit<AuthAccountRecord, "id" | "createdAt">): void {
    this.#sequence += 1;
    this.#accounts.set(this.#sequence, {
      ...account,
      id: this.#sequence,
      createdAt: IN_MEMORY_ACCOUNT_CREATED_AT,
    });
  }
}
