import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import {
  accountAlreadyExists,
  AuthPersistenceConflict,
} from "#api/modules/identity/auth/application/auth.errors";
import { AuthAccountRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-account.repository.port";
import {
  isUniqueConstraintViolation,
  requireRecord,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { account } from "#api/platform/database/schema/index";
import { EncryptionService } from "#api/platform/encryption/index";

type AccountRow = typeof account.$inferSelect;
type AccountProvider = AccountRow["provider"];

import type { IdentityAccounts } from "../../domain/identity-accounts.aggregate.js";
import { toIdentityAccounts } from "./auth-row.mapper.js";

@Injectable()
export class DrizzleAccountRepository extends AuthAccountRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #encryptionService: EncryptionService;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    encryptionService: EncryptionService,
  ) {
    super();
    this.#txHost = txHost;
    this.#encryptionService = encryptionService;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findByUserIdAndProvider(
    userId: string,
    provider: AccountProvider,
  ): Promise<AccountRow | null> {
    const row = await this.#db.query.account.findFirst({ where: { userId, provider } });
    return row ?? null;
  }

  async findByProviderAccountId(
    provider: AccountProvider,
    providerAccountId: string,
  ): Promise<AccountRow | null> {
    const row = await this.#db.query.account.findFirst({ where: { provider, providerAccountId } });
    return row ?? null;
  }

  async createCredentialAccount(userId: string, hashedPassword: string): Promise<AccountRow> {
    try {
      const [row] = await this.#db
        .insert(account)
        .values({
          userId,
          provider: "CREDENTIAL",
          providerAccountId: userId, // userId를 사용하여 unique constraint 보장
          password: hashedPassword,
        })
        .returning();
      return requireRecord(row);
    } catch (error) {
      // Account_userId_provider_key·Account_provider_providerAccountId_key: 필터의 옛 제약 표와 같은 USER_0604
      if (isUniqueConstraintViolation(error)) {
        throw accountAlreadyExists();
      }
      throw error;
    }
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<AccountRow> {
    const [row] = await this.#db
      .update(account)
      .set({ password: hashedPassword })
      .where(and(eq(account.userId, userId), eq(account.provider, "CREDENTIAL")))
      .returning();
    return requireRecord(row);
  }

  async updatePasswordIfUnchanged(
    userId: string,
    expectedPasswordHash: string,
    passwordHash: string,
  ): Promise<boolean> {
    const updated = await this.#db
      .update(account)
      .set({ password: passwordHash })
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

  async createOAuthAccount(data: {
    userId: string;
    provider: AccountProvider;
    providerAccountId: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: Date;
    scope?: string;
  }): Promise<AccountRow> {
    try {
      const [row] = await this.#db
        .insert(account)
        .values({
          userId: data.userId,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          accessToken: data.accessToken
            ? this.#encryptionService.encrypt(data.accessToken)
            : undefined,
          refreshToken: data.refreshToken
            ? this.#encryptionService.encrypt(data.refreshToken)
            : undefined,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
          scope: data.scope,
        })
        .returning();
      return requireRecord(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AuthPersistenceConflict("OAUTH_ACCOUNT_ALREADY_LINKED");
      }
      throw error;
    }
  }

  async deleteAccount(userId: string, provider: AccountProvider): Promise<AccountRow> {
    const [row] = await this.#db
      .delete(account)
      .where(and(eq(account.userId, userId), eq(account.provider, provider)))
      .returning();
    return requireRecord(row);
  }

  async findAllByUserId(userId: string): Promise<AccountRow[]> {
    return this.#db.query.account.findMany({ where: { userId } });
  }

  async findIdentityAccounts(userId: string): Promise<IdentityAccounts> {
    const rows = await this.#db.query.account.findMany({
      columns: { id: true, provider: true, providerAccountId: true, createdAt: true },
      where: { userId },
    });
    return toIdentityAccounts(userId, rows);
  }
}
