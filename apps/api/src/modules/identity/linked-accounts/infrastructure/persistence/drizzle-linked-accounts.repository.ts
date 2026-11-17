import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { accountAlreadyExists } from "#api/modules/identity/linked-accounts/application/linked-accounts.errors";
import {
  type LinkedAccountReadModel,
  LinkedAccountsRepositoryPort,
  type NewOAuthAccount,
} from "#api/modules/identity/linked-accounts/application/ports/linked-accounts.repository.port";
import type { LinkedAccounts } from "#api/modules/identity/linked-accounts/domain/linked-accounts.aggregate";
import type { AccountProvider } from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import { IdentityPersistenceConflict } from "#api/modules/identity/shared/domain/identity.errors";
import { isUniqueConstraintViolation } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { linkedAccount } from "#api/platform/database/schema/index";
import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { toLinkedAccountReadModel, toLinkedAccounts } from "./linked-accounts-row.mapper.js";

@Injectable()
export class DrizzleLinkedAccountsRepository extends LinkedAccountsRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #encryptionService: EncryptionService;
  readonly #clock: ClockPort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    encryptionService: EncryptionService,
    clock: ClockPort,
  ) {
    super();
    this.#transactionHost = transactionHost;
    this.#encryptionService = encryptionService;
    this.#clock = clock;
  }

  get #db() {
    return this.#transactionHost.tx;
  }

  async findByUserIdAndProvider(
    userId: UserId,
    provider: AccountProvider,
  ): Promise<LinkedAccountReadModel | null> {
    const row = await this.#db.query.linkedAccount.findFirst({
      where: { userId: userId.value, provider },
    });
    return row == null ? null : toLinkedAccountReadModel(row);
  }

  async findByProviderAccountId(
    provider: AccountProvider,
    providerAccountId: string,
  ): Promise<LinkedAccountReadModel | null> {
    const row = await this.#db.query.linkedAccount.findFirst({
      where: { provider, providerAccountId },
    });
    return row == null ? null : toLinkedAccountReadModel(row);
  }

  async findAllByUserId(userId: UserId): Promise<LinkedAccountReadModel[]> {
    const rows = await this.#db.query.linkedAccount.findMany({
      where: { userId: userId.value },
      orderBy: { id: "asc" },
    });
    return rows.map(toLinkedAccountReadModel);
  }

  async findLinkedAccounts(userId: UserId): Promise<LinkedAccounts> {
    const rows = await this.#db.query.linkedAccount.findMany({
      columns: { id: true, provider: true, providerAccountId: true, createdAt: true },
      where: { userId: userId.value },
      orderBy: { id: "asc" },
    });
    return toLinkedAccounts(userId.value, rows);
  }

  async createCredentialAccount(userId: UserId, hashedPassword: string): Promise<void> {
    try {
      await this.#db.insert(linkedAccount).values({
        userId: userId.value,
        provider: "CREDENTIAL",
        // 이메일 계정은 공급자 계정 id가 없어 userId로 유일 제약을 채운다
        providerAccountId: userId.value,
        password: hashedPassword,
        updatedAt: this.#clock.now(),
      });
    } catch (error) {
      // Account_userId_provider_key·Account_provider_providerAccountId_key: 출시 앱이 받던 USER_0604
      if (isUniqueConstraintViolation(error)) {
        throw accountAlreadyExists();
      }
      throw error;
    }
  }

  async updatePassword(userId: UserId, hashedPassword: string): Promise<void> {
    await this.#db
      .update(linkedAccount)
      .set({ password: hashedPassword, updatedAt: this.#clock.now() })
      .where(and(eq(linkedAccount.userId, userId.value), eq(linkedAccount.provider, "CREDENTIAL")));
  }

  async updatePasswordIfUnchanged(
    userId: UserId,
    expectedPasswordHash: string,
    passwordHash: string,
  ): Promise<boolean> {
    const updated = await this.#db
      .update(linkedAccount)
      .set({ password: passwordHash, updatedAt: this.#clock.now() })
      .where(
        and(
          eq(linkedAccount.userId, userId.value),
          eq(linkedAccount.provider, "CREDENTIAL"),
          eq(linkedAccount.password, expectedPasswordHash),
        ),
      )
      .returning({ id: linkedAccount.id });
    return updated.length === 1;
  }

  async createOAuthAccount(newAccount: NewOAuthAccount): Promise<void> {
    try {
      await this.#db.insert(linkedAccount).values({
        userId: newAccount.userId.value,
        provider: newAccount.provider,
        providerAccountId: newAccount.providerAccountId,
        refreshToken:
          newAccount.refreshToken == null || newAccount.refreshToken === ""
            ? undefined
            : this.#encryptionService.encrypt(newAccount.refreshToken),
        updatedAt: this.#clock.now(),
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new IdentityPersistenceConflict("OAUTH_ACCOUNT_ALREADY_LINKED");
      }
      throw error;
    }
  }

  async deleteAccount(userId: UserId, provider: AccountProvider): Promise<void> {
    await this.#db
      .delete(linkedAccount)
      .where(and(eq(linkedAccount.userId, userId.value), eq(linkedAccount.provider, provider)));
  }
}
