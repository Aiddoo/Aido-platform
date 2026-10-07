import { randomBytes } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, or } from "@prisma/orm-postgres/orm-client";

import type {
  AuthOAuthStateRecord,
  AuthOAuthStateRepositoryPort,
  ConsumeAuthOAuthStateInput,
} from "#api/modules/identity/application/ports/auth/auth-persistence.port";
import type { OAuthMode } from "#api/modules/identity/application/ports/auth/oauth-identity-provider.port";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import type { AccountProvider, OAuthState } from "#api/platform/database/database.types";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { EncryptionService } from "#api/platform/encryption/index";
import { addMinutes } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";

export type { OAuthMode };

@Injectable()
export class OAuthStateRepository implements AuthOAuthStateRepositoryPort {
  constructor(
    private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>,
    private readonly encryptionService: EncryptionService,
  ) {}

  private get client() {
    return this.txHost.tx;
  }

  async create(
    state: string,
    provider: AccountProvider,
    redirectUri: string,
    options?: {
      mode?: OAuthMode;
      codeVerifier?: string;
      ipAddress?: string;
      userAgent?: string;
      expiresInMinutes?: number;
      initiatingUserId?: string;
    },
  ): Promise<OAuthState> {
    const expiresAt = addMinutes(options?.expiresInMinutes ?? 10);

    return this.client.orm.public.OAuthState.create(
      encodeCreate("OAuthState", {
        state,
        provider,
        redirectUri,
        mode: options?.mode,
        codeVerifier: options?.codeVerifier,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
        initiatingUserId: options?.initiatingUserId,
        expiresAt,
      }),
    ).then((row) => decodeRecord("OAuthState", row));
  }

  async findByState(state: string): Promise<OAuthState | null> {
    return this.client.orm.public.OAuthState.where((row) =>
      and(row.state.eq(varchar(state, 64)), row.expiresAt.gt(databaseTimestamp(now()))),
    )
      .first()
      .then((row) => decodeRecord("OAuthState", row));
  }

  async findByExchangeCode(
    exchangeCode: string,
    at: Date = now(),
  ): Promise<AuthOAuthStateRecord | null> {
    const state = decodeRecord(
      "OAuthState",
      await this.client.orm.public.OAuthState.where((row) =>
        and(
          row.exchangeCode.eq(varchar(exchangeCode, 64)),
          row.exchangedAt.isNull(),
          row.expiresAt.gt(databaseTimestamp(at)),
        ),
      ).first(),
    );
    if (state === null) {
      return null;
    }
    return {
      id: state.id,
      state: state.state,
      provider: state.provider,
      redirectUri: state.redirectUri,
      mode: state.mode,
      initiatingUserId: state.initiatingUserId,
      exchangeCode: state.exchangeCode,
      accessToken:
        state.accessToken !== null && state.accessToken !== ""
          ? this.encryptionService.decryptSafe(state.accessToken)
          : null,
      refreshToken:
        state.refreshToken !== null && state.refreshToken !== ""
          ? this.encryptionService.decryptSafe(state.refreshToken)
          : null,
      userId: state.userId,
      userName: state.userName,
      profileImage: state.profileImage,
      accountRestored: state.accountRestored,
      expiresAt: state.expiresAt,
      exchangedAt: state.exchangedAt,
    };
  }

  async saveExchangeData(
    id: number,
    data: {
      exchangeCode: string;
      accessToken: string;
      refreshToken: string;
      userId: string;
      userName?: string;
      profileImage?: string;
      accountRestored?: boolean;
    },
  ): Promise<OAuthState> {
    return this.client.orm.public.OAuthState.where((row) => row.id.eq(id))
      .update(
        encodePatch("OAuthState", {
          exchangeCode: data.exchangeCode,
          accessToken: this.encryptionService.encrypt(data.accessToken),
          refreshToken: this.encryptionService.encrypt(data.refreshToken),
          userId: data.userId,
          userName: data.userName,
          profileImage: data.profileImage,
          accountRestored: data.accountRestored,
        }),
      )
      .then((row) => decodeRecord("OAuthState", requireRecord(row)));
  }

  async saveLinkingData(
    id: number,
    data: {
      exchangeCode: string;
      provider: AccountProvider;
      providerAccountId: string;
    },
  ): Promise<OAuthState> {
    return this.client.orm.public.OAuthState.where((row) => row.id.eq(id))
      .update(
        encodePatch("OAuthState", {
          exchangeCode: data.exchangeCode,
          provider: data.provider,
          userId: data.providerAccountId, // providerAccountId를 userId 필드에 임시 저장
        }),
      )
      .then((row) => decodeRecord("OAuthState", requireRecord(row)));
  }

  async consumeExchangeCode(input: ConsumeAuthOAuthStateInput): Promise<boolean> {
    const count = await this.client.orm.public.OAuthState.where((row) =>
      and(
        row.id.eq(input.id),
        row.exchangeCode.eq(varchar(input.exchangeCode, 64)),
        row.exchangedAt.isNull(),
        row.expiresAt.gt(databaseTimestamp(input.at)),
        ...(input.purpose === "link"
          ? [
              row.mode.eq(varchar("link", 10)),
              or(
                row.initiatingUserId.isNull(),
                row.initiatingUserId.eq(varchar("", 36)),
                row.initiatingUserId.eq(varchar(input.actorUserId, 36)),
              ),
            ]
          : []),
      ),
    ).updateAndCount(
      encodePatch("OAuthState", {
        exchangedAt: input.at,
        accessToken: null,
        refreshToken: null,
      }),
    );
    return count === 1;
  }

  generateExchangeCode(): string {
    return randomBytes(32).toString("base64url");
  }
}
