import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

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
import type { IdentityAccounts } from "#api/modules/identity/auth/domain/identity-accounts.aggregate";
import { isUniqueConstraintViolation } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { account } from "#api/platform/database/schema/index";
import { EncryptionService } from "#api/platform/encryption/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { toAuthAccountRecord, toIdentityAccounts } from "./auth-row.mapper.js";

@Injectable()
export class DrizzleAccountRepository extends AuthAccountRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #encryptionService: EncryptionService;
  readonly #clock: ClockPort;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    encryptionService: EncryptionService,
    clock: ClockPort,
  ) {
    super();
    this.#txHost = txHost;
    this.#encryptionService = encryptionService;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findByUserIdAndProvider(
    userId: string,
    provider: AccountProvider,
  ): Promise<AuthAccountRecord | null> {
    const row = await this.#db.query.account.findFirst({ where: { userId, provider } });
    return row == null ? null : toAuthAccountRecord(row);
  }

  async findByProviderAccountId(
    provider: AccountProvider,
    providerAccountId: string,
  ): Promise<AuthAccountRecord | null> {
    const row = await this.#db.query.account.findFirst({ where: { provider, providerAccountId } });
    return row == null ? null : toAuthAccountRecord(row);
  }

  async findAllByUserId(userId: string): Promise<AuthAccountRecord[]> {
    const rows = await this.#db.query.account.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    });
    return rows.map(toAuthAccountRecord);
  }

  async findIdentityAccounts(userId: string): Promise<IdentityAccounts> {
    const rows = await this.#db.query.account.findMany({
      columns: { id: true, provider: true, providerAccountId: true, createdAt: true },
      where: { userId },
      orderBy: { id: "asc" },
    });
    return toIdentityAccounts(userId, rows);
  }

  async createCredentialAccount(userId: string, hashedPassword: string): Promise<void> {
    try {
      await this.#db.insert(account).values({
        userId,
        provider: "CREDENTIAL",
        // 이메일 계정은 공급자 계정 id가 없어 userId로 유일 제약을 채운다
        providerAccountId: userId,
        password: hashedPassword,
        updatedAt: this.#clock.now(),
      });
    } catch (error) {
      // Account_userId_provider_key·Account_provider_providerAccountId_key: 필터의 옛 제약 표와 같은 USER_0604
      if (isUniqueConstraintViolation(error)) {
        throw accountAlreadyExists();
      }
      throw error;
    }
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.#db
      .update(account)
      .set({ password: hashedPassword, updatedAt: this.#clock.now() })
      .where(and(eq(account.userId, userId), eq(account.provider, "CREDENTIAL")));
  }

  async updatePasswordIfUnchanged(
    userId: string,
    expectedPasswordHash: string,
    passwordHash: string,
  ): Promise<boolean> {
    const updated = await this.#db
      .update(account)
      .set({ password: passwordHash, updatedAt: this.#clock.now() })
      .where(
        and(
          eq(account.userId, userId),
          eq(account.provider, "CREDENTIAL"),
          eq(account.password, expectedPasswordHash),
        ),
      )
      .returning({ id: account.id });
    return updated.length === 1;
  }

  async createOAuthAccount(newAccount: NewOAuthAccount): Promise<void> {
    try {
      await this.#db.insert(account).values({
        userId: newAccount.userId,
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
        throw new AuthPersistenceConflict("OAUTH_ACCOUNT_ALREADY_LINKED");
      }
      throw error;
    }
  }

  async deleteAccount(userId: string, provider: AccountProvider): Promise<void> {
    await this.#db
      .delete(account)
      .where(and(eq(account.userId, userId), eq(account.provider, provider)));
  }
}
