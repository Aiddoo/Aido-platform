import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import { AuthPersistenceConflict } from "#api/auth/application/ports/auth-persistence.port";
import {
  decodeRecord,
  encodeCreate,
  encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import { varchar } from "#api/shared/infrastructure/database/database-values";
import type { Account, AccountProvider } from "#api/shared/infrastructure/database/database.types";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import { isUniqueConstraintViolation } from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";
import { EncryptionService } from "#api/shared/infrastructure/encryption/index";

@Injectable()
export class AccountRepository {
  constructor(
    private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>,
    private readonly encryptionService: EncryptionService,
  ) {}

  /** 활성 트랜잭션(없으면 베이스 클라이언트) */
  private get client() {
    return this.txHost.tx;
  }

  async findByUserIdAndProvider(
    userId: string,
    provider: AccountProvider,
  ): Promise<Account | null> {
    return this.client.orm.public.Account.where((row) =>
      and(row.userId.eq(userId), row.provider.eq(provider)),
    )
      .first()
      .then((row) => decodeRecord("Account", row));
  }

  async findByProviderAccountId(
    provider: AccountProvider,
    providerAccountId: string,
  ): Promise<Account | null> {
    return this.client.orm.public.Account.where((row) =>
      and(row.provider.eq(provider), row.providerAccountId.eq(varchar(providerAccountId, 255))),
    )
      .first()
      .then((row) => decodeRecord("Account", row));
  }

  async createCredentialAccount(userId: string, hashedPassword: string): Promise<Account> {
    return this.client.orm.public.Account.create(
      encodeCreate("Account", {
        userId,
        provider: "CREDENTIAL",
        providerAccountId: userId, // userId를 사용하여 unique constraint 보장
        password: hashedPassword,
      }),
    ).then((row) => decodeRecord("Account", row));
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<Account> {
    return this.client.orm.public.Account.where((row) =>
      and(row.userId.eq(userId), row.provider.eq("CREDENTIAL")),
    )
      .update(encodePatch("Account", { password: hashedPassword }))
      .then((row) => decodeRecord("Account", requireRecord(row)));
  }

  async createOAuthAccount(data: {
    userId: string;
    provider: AccountProvider;
    providerAccountId: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: Date;
    scope?: string;
  }): Promise<Account> {
    try {
      return decodeRecord(
        "Account",
        await this.client.orm.public.Account.create(
          encodeCreate("Account", {
            userId: data.userId,
            provider: data.provider,
            providerAccountId: data.providerAccountId,
            accessToken: data.accessToken
              ? this.encryptionService.encrypt(data.accessToken)
              : undefined,
            refreshToken: data.refreshToken
              ? this.encryptionService.encrypt(data.refreshToken)
              : undefined,
            accessTokenExpiresAt: data.accessTokenExpiresAt,
            scope: data.scope,
          }),
        ),
      );
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AuthPersistenceConflict("OAUTH_ACCOUNT_ALREADY_LINKED");
      }
      throw error;
    }
  }

  async updateOAuthTokens(
    userId: string,
    provider: AccountProvider,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      accessTokenExpiresAt?: Date;
    },
  ): Promise<Account> {
    return this.client.orm.public.Account.where((row) =>
      and(row.userId.eq(userId), row.provider.eq(provider)),
    )
      .update(
        encodePatch("Account", {
          accessToken: this.encryptionService.encrypt(tokens.accessToken),
          ...(tokens.refreshToken && {
            refreshToken: this.encryptionService.encrypt(tokens.refreshToken),
          }),
          ...(tokens.accessTokenExpiresAt && {
            accessTokenExpiresAt: tokens.accessTokenExpiresAt,
          }),
        }),
      )
      .then((row) => decodeRecord("Account", requireRecord(row)));
  }

  async deleteAccount(userId: string, provider: AccountProvider): Promise<Account> {
    return this.client.orm.public.Account.where((row) =>
      and(row.userId.eq(userId), row.provider.eq(provider)),
    )
      .delete()
      .then((row) => decodeRecord("Account", requireRecord(row)));
  }

  async findAllByUserId(userId: string): Promise<Account[]> {
    return this.client.orm.public.Account.where((row) => row.userId.eq(userId))
      .all()
      .then((row) => decodeRecord("Account", row));
  }
}
