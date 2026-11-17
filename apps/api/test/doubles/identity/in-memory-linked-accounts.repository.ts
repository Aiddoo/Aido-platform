import { LinkedAccountsRepositoryPort } from "#api/modules/identity/linked-accounts/application/ports/linked-accounts.repository.port";
import { LinkedAccountId } from "#api/modules/identity/linked-accounts/domain/linked-account-id.vo";
import type { LinkedAccount } from "#api/modules/identity/linked-accounts/domain/linked-account.entity";
import { LinkedAccounts } from "#api/modules/identity/linked-accounts/domain/linked-accounts.aggregate";
import type { AccountProvider } from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

const IN_MEMORY_ACCOUNT_CREATED_AT = Temporal.Instant.from("2026-11-10T00:00:00Z");

/** `Account` 행과 같은 모양이다. password 칸이 비밀번호 hash다 */
export interface InMemoryLinkedAccountRow {
  readonly id: number;
  readonly userId: string;
  readonly provider: AccountProvider;
  readonly providerAccountId: string;
  readonly password: string | null;
  readonly createdAt: Temporal.Instant;
}

export class InMemoryLinkedAccountsRepository extends LinkedAccountsRepositoryPort {
  readonly #rows = new Map<number, InMemoryLinkedAccountRow>();
  #sequence: number;

  constructor(rows: readonly InMemoryLinkedAccountRow[] = []) {
    super();
    for (const row of rows) {
      this.#rows.set(row.id, row);
    }
    this.#sequence = Math.max(0, ...this.#rows.keys());
  }

  get all(): readonly InMemoryLinkedAccountRow[] {
    return [...this.#rows.values()].toSorted((left, right) => left.id - right.id);
  }

  seed(account: {
    readonly userId: string;
    readonly provider: AccountProvider;
    readonly providerAccountId: string;
    readonly password?: string | null;
  }): void {
    this.#sequence += 1;
    this.#rows.set(this.#sequence, {
      password: null,
      ...account,
      id: this.#sequence,
      createdAt: IN_MEMORY_ACCOUNT_CREATED_AT,
    });
  }

  storedByProvider(userId: string, provider: AccountProvider): InMemoryLinkedAccountRow | null {
    return this.all.find((row) => row.userId === userId && row.provider === provider) ?? null;
  }

  storedByProviderAccountId(
    provider: AccountProvider,
    providerAccountId: string,
  ): InMemoryLinkedAccountRow | null {
    return (
      this.all.find(
        (row) => row.provider === provider && row.providerAccountId === providerAccountId,
      ) ?? null
    );
  }

  async nextId(): Promise<LinkedAccountId> {
    this.#sequence += 1;
    return LinkedAccountId.reconstitute(this.#sequence);
  }

  async findByUserId(userId: UserId): Promise<LinkedAccounts | null> {
    const rows = this.all.filter((row) => row.userId === userId.value);
    if (rows.length === 0) {
      return null;
    }
    return LinkedAccounts.reconstitute({
      userId: userId.value,
      accounts: rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        providerAccountId: row.providerAccountId,
        passwordHash: row.password,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      })),
    });
  }

  async findUserIdByProviderAccountId(
    provider: AccountProvider,
    providerAccountId: string,
  ): Promise<UserId | null> {
    const row = this.all.find(
      (candidate) =>
        candidate.provider === provider && candidate.providerAccountId === providerAccountId,
    );
    return row == null ? null : UserId.reconstitute(row.userId);
  }

  async save(linkedAccounts: LinkedAccounts): Promise<boolean> {
    const userId = linkedAccounts.id.value;
    for (const account of linkedAccounts.unlinkedSinceLoad()) {
      if (!this.#rows.delete(account.id.value)) {
        return false;
      }
    }
    for (const account of linkedAccounts.linkedSinceLoad()) {
      if (this.#isTaken(userId, account)) {
        return false;
      }
      this.#rows.set(account.id.value, {
        id: account.id.value,
        userId,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        password: account.passwordHash,
        createdAt: account.createdAt,
      });
    }
    const changed = linkedAccounts.passwordChangedSinceLoad();
    if (changed == null) {
      return true;
    }
    const stored = this.#rows.get(changed.id.value);
    if (stored == null || stored.password !== changed.persistedPasswordHash) {
      return false;
    }
    this.#rows.set(stored.id, { ...stored, password: changed.passwordHash });
    return true;
  }

  // Account_userId_provider_key·Account_provider_providerAccountId_key 두 유일 제약과 같다
  #isTaken(userId: string, account: LinkedAccount): boolean {
    return this.all.some(
      (row) =>
        row.provider === account.provider &&
        (row.userId === userId || row.providerAccountId === account.providerAccountId),
    );
  }
}
