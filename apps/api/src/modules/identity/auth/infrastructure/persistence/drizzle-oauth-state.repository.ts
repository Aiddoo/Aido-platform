import { randomBytes } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, or } from "drizzle-orm";

import {
  AuthOAuthStateRepositoryPort,
  type ConsumeAuthOAuthStateInput,
} from "#api/modules/identity/auth/application/ports/auth-oauth-state.repository.port";
import type { OAuthMode } from "#api/modules/identity/auth/application/ports/oauth-identity-provider.port";
import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { oAuthState } from "#api/platform/database/schema/index";
import { EncryptionService } from "#api/platform/encryption/index";
import { addMinutes } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { AuthOAuthState } from "../../domain/auth-oauth-state.aggregate.js";
import { toAuthOAuthState } from "./auth-row.mapper.js";

export type { OAuthMode };

type OAuthStateRow = typeof oAuthState.$inferSelect;
type AccountProvider = OAuthStateRow["provider"];

@Injectable()
export class DrizzleOAuthStateRepository extends AuthOAuthStateRepositoryPort {
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
  ): Promise<OAuthStateRow> {
    const expiresAt = addMinutes(options?.expiresInMinutes ?? 10);

    const [row] = await this.#db
      .insert(oAuthState)
      .values({
        state,
        provider,
        redirectUri,
        mode: options?.mode,
        codeVerifier: options?.codeVerifier,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
        initiatingUserId: options?.initiatingUserId,
        expiresAt,
      })
      .returning();
    return requireRecord(row);
  }

  async findByState(state: string): Promise<OAuthStateRow | null> {
    const row = await this.#db.query.oAuthState.findFirst({
      where: { state, expiresAt: { gt: now() } },
    });
    return row ?? null;
  }

  async findByExchangeCode(
    exchangeCode: string,
    now: Temporal.Instant,
  ): Promise<AuthOAuthState | null> {
    const state = await this.#db.query.oAuthState.findFirst({
      where: { exchangeCode, exchangedAt: { isNull: true }, expiresAt: { gt: instantToDate(now) } },
    });
    if (state == null) {
      return null;
    }
    // 저장한 토큰은 암호문이라 복원 전에 푼다
    return toAuthOAuthState({
      ...state,
      accessToken:
        state.accessToken != null && state.accessToken !== ""
          ? this.#encryptionService.decryptSafe(state.accessToken)
          : null,
      refreshToken:
        state.refreshToken != null && state.refreshToken !== ""
          ? this.#encryptionService.decryptSafe(state.refreshToken)
          : null,
      userId: state.userId,
      userName: state.userName,
      profileImage: state.profileImage,
      accountRestored: state.accountRestored,
    });
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
      isNewUser: boolean;
    },
  ): Promise<OAuthStateRow> {
    const [row] = await this.#db
      .update(oAuthState)
      .set({
        exchangeCode: data.exchangeCode,
        accessToken: this.#encryptionService.encrypt(data.accessToken),
        refreshToken: this.#encryptionService.encrypt(data.refreshToken),
        userId: data.userId,
        userName: data.userName,
        profileImage: data.profileImage,
        accountRestored: data.accountRestored,
        isNewUser: data.isNewUser,
      })
      .where(eq(oAuthState.id, id))
      .returning();
    return requireRecord(row);
  }

  async saveLinkingData(
    id: number,
    data: {
      exchangeCode: string;
      provider: AccountProvider;
      providerAccountId: string;
    },
  ): Promise<OAuthStateRow> {
    const [row] = await this.#db
      .update(oAuthState)
      .set({
        exchangeCode: data.exchangeCode,
        provider: data.provider,
        userId: data.providerAccountId, // providerAccountId를 userId 필드에 임시 저장
      })
      .where(eq(oAuthState.id, id))
      .returning();
    return requireRecord(row);
  }

  async consumeExchangeCode(input: ConsumeAuthOAuthStateInput): Promise<boolean> {
    const consumed = await this.#db
      .update(oAuthState)
      .set({ exchangedAt: instantToDate(input.at), accessToken: null, refreshToken: null })
      .where(
        and(
          eq(oAuthState.id, input.id),
          eq(oAuthState.exchangeCode, input.exchangeCode),
          isNull(oAuthState.exchangedAt),
          gt(oAuthState.expiresAt, instantToDate(input.at)),
          input.purpose === "link"
            ? and(
                eq(oAuthState.mode, "link"),
                or(
                  isNull(oAuthState.initiatingUserId),
                  eq(oAuthState.initiatingUserId, ""),
                  eq(oAuthState.initiatingUserId, input.actorUserId),
                ),
              )
            : undefined,
        ),
      )
      .returning({ id: oAuthState.id });
    return consumed.length === 1;
  }

  generateExchangeCode(): string {
    return randomBytes(32).toString("base64url");
  }
}
