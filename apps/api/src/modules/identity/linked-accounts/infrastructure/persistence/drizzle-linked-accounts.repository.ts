import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { LinkedAccountsRepositoryPort } from "#api/modules/identity/linked-accounts/application/ports/linked-accounts.repository.port";
import { LinkedAccountId } from "#api/modules/identity/linked-accounts/domain/linked-account-id.vo";
import type { LinkedAccount } from "#api/modules/identity/linked-accounts/domain/linked-account.entity";
import type { LinkedAccounts } from "#api/modules/identity/linked-accounts/domain/linked-accounts.aggregate";
import type { AccountProvider } from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { linkedAccount } from "#api/platform/database/schema/index";
import { nextSequenceValue } from "#api/platform/database/sequence";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { toLinkedAccountRow, toLinkedAccounts } from "./linked-accounts-row.mapper.js";

@Injectable()
export class DrizzleLinkedAccountsRepository extends LinkedAccountsRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  async nextId(): Promise<LinkedAccountId> {
    return LinkedAccountId.reconstitute(await nextSequenceValue(this.#db, linkedAccount.id));
  }

  async findByUserId(userId: UserId): Promise<LinkedAccounts | null> {
    const rows = await this.#db.query.linkedAccount.findMany({
      columns: {
        id: true,
        provider: true,
        providerAccountId: true,
        password: true,
        createdAt: true,
        updatedAt: true,
      },
      where: { userId: userId.value },
      orderBy: { id: "asc" },
    });
    return toLinkedAccounts(userId.value, rows);
  }

  async findUserIdByProviderAccountId(
    provider: AccountProvider,
    providerAccountId: string,
  ): Promise<UserId | null> {
    const row = await this.#db.query.linkedAccount.findFirst({
      columns: { userId: true },
      where: { provider, providerAccountId },
    });
    return row == null ? null : UserId.reconstitute(row.userId);
  }

  async save(linkedAccounts: LinkedAccounts): Promise<boolean> {
    const userId = linkedAccounts.id.value;
    return (
      (await this.#deleteUnlinked(userId, linkedAccounts.unlinkedSinceLoad())) &&
      (await this.#insertLinked(userId, linkedAccounts.linkedSinceLoad())) &&
      (await this.#updateChangedPassword(linkedAccounts.passwordChangedSinceLoad()))
    );
  }

  async #deleteUnlinked(userId: string, accounts: readonly LinkedAccount[]): Promise<boolean> {
    if (accounts.length === 0) {
      return true;
    }
    const deleted = await this.#db
      .delete(linkedAccount)
      .where(
        and(
          eq(linkedAccount.userId, userId),
          inArray(
            linkedAccount.id,
            accounts.map((account) => account.id.value),
          ),
        ),
      )
      .returning({ id: linkedAccount.id });
    return deleted.length === accounts.length;
  }

  // Account_userId_provider_key·Account_provider_providerAccountId_key에 걸리면 넣지 않고 false다
  async #insertLinked(userId: string, accounts: readonly LinkedAccount[]): Promise<boolean> {
    if (accounts.length === 0) {
      return true;
    }
    const inserted = await this.#db
      .insert(linkedAccount)
      .values(accounts.map((account) => toLinkedAccountRow(userId, account)))
      .onConflictDoNothing()
      .returning({ id: linkedAccount.id });
    return inserted.length === accounts.length;
  }

  async #updateChangedPassword(account: LinkedAccount | null): Promise<boolean> {
    if (account == null) {
      return true;
    }
    const persistedPasswordHash = account.persistedPasswordHash;
    const updated = await this.#db
      .update(linkedAccount)
      .set({ password: account.passwordHash, updatedAt: account.updatedAt })
      .where(
        and(
          eq(linkedAccount.id, account.id.value),
          persistedPasswordHash == null
            ? isNull(linkedAccount.password)
            : eq(linkedAccount.password, persistedPasswordHash),
        ),
      )
      .returning({ id: linkedAccount.id });
    return updated.length > 0;
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
