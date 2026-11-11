import { randomBytes } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, or } from "drizzle-orm";

import {
  type AuthOAuthLinkingData,
  type AuthOAuthLoginExchangeData,
  AuthOAuthStateRepositoryPort,
  type ConsumeAuthOAuthStateInput,
  type NewAuthOAuthState,
} from "#api/modules/identity/auth/application/ports/auth-oauth-state.repository.port";
import type { AuthOAuthState } from "#api/modules/identity/auth/domain/auth-oauth-state.aggregate";
import type { OAuthStateId } from "#api/modules/identity/auth/domain/oauth-state-id.vo";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { oAuthState } from "#api/platform/database/schema/index";
import { EncryptionService } from "#api/platform/encryption/encryption.service";

import { toAuthOAuthState } from "./auth-row.mapper.js";

type OAuthStateRow = typeof oAuthState.$inferSelect;

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

  async create(input: NewAuthOAuthState): Promise<void> {
    await this.#db.insert(oAuthState).values({
      state: input.state,
      provider: input.provider,
      redirectUri: input.redirectUri,
      mode: input.mode,
      initiatingUserId: input.initiatingUserId?.value,
      expiresAt: input.expiresAt,
    });
  }

  async findByState(state: string, now: Temporal.Instant): Promise<AuthOAuthState | null> {
    const row = await this.#db.query.oAuthState.findFirst({
      where: { state, expiresAt: { gt: now } },
    });
    return row == null ? null : this.#toOAuthState(row);
  }

  async findByExchangeCode(
    exchangeCode: string,
    now: Temporal.Instant,
  ): Promise<AuthOAuthState | null> {
    const row = await this.#db.query.oAuthState.findFirst({
      where: { exchangeCode, exchangedAt: { isNull: true }, expiresAt: { gt: now } },
    });
    return row == null ? null : this.#toOAuthState(row);
  }

  async saveExchangeData(
    oauthStateId: OAuthStateId,
    data: AuthOAuthLoginExchangeData,
  ): Promise<void> {
    await this.#db
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
      .where(eq(oAuthState.id, oauthStateId.value));
  }

  async saveLinkingData(oauthStateId: OAuthStateId, data: AuthOAuthLinkingData): Promise<void> {
    await this.#db
      .update(oAuthState)
      .set({
        exchangeCode: data.exchangeCode,
        provider: data.provider,
        // 연결 교환은 공급자 계정 id를 userId 칸에 저장해 왔다
        userId: data.providerAccountId,
      })
      .where(eq(oAuthState.id, oauthStateId.value));
  }

  async consumeExchangeCode(input: ConsumeAuthOAuthStateInput): Promise<boolean> {
    const consumed = await this.#db
      .update(oAuthState)
      .set({ exchangedAt: input.at, accessToken: null, refreshToken: null })
      .where(
        and(
          eq(oAuthState.id, input.id.value),
          eq(oAuthState.exchangeCode, input.exchangeCode),
          isNull(oAuthState.exchangedAt),
          gt(oAuthState.expiresAt, input.at),
          input.purpose === "link"
            ? and(
                eq(oAuthState.mode, "link"),
                or(
                  isNull(oAuthState.initiatingUserId),
                  eq(oAuthState.initiatingUserId, ""),
                  eq(oAuthState.initiatingUserId, input.actorUserId.value),
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

  // 저장한 토큰은 암호문이라 복원 전에 푼다
  #toOAuthState(row: OAuthStateRow): AuthOAuthState {
    return toAuthOAuthState({
      ...row,
      accessToken:
        row.accessToken != null && row.accessToken !== ""
          ? this.#encryptionService.decryptSafe(row.accessToken)
          : null,
      refreshToken:
        row.refreshToken != null && row.refreshToken !== ""
          ? this.#encryptionService.decryptSafe(row.refreshToken)
          : null,
    });
  }
}
