import { randomBytes } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, inArray, isNull, lt } from "drizzle-orm";

import {
  type OAuthLinkingData,
  type OAuthLoginExchangeData,
  OAuthStateRepositoryPort,
  type NewOAuthState,
} from "#api/modules/identity/oauth-states/application/ports/oauth-state.repository.port";
import type { OAuthStateId } from "#api/modules/identity/oauth-states/domain/oauth-state-id.vo";
import type { OAuthState } from "#api/modules/identity/oauth-states/domain/oauth-state.aggregate";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { oAuthState } from "#api/platform/database/schema/index";
import { EncryptionService } from "#api/platform/encryption/encryption.service";

import { toOAuthState } from "./oauth-state-row.mapper.js";

type OAuthStateRow = typeof oAuthState.$inferSelect;

@Injectable()
export class DrizzleOAuthStateRepository extends OAuthStateRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #encryptionService: EncryptionService;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    encryptionService: EncryptionService,
  ) {
    super();
    this.#transactionHost = transactionHost;
    this.#encryptionService = encryptionService;
  }

  async create(input: NewOAuthState): Promise<void> {
    await this.#db.insert(oAuthState).values({
      state: input.state,
      provider: input.provider,
      redirectUri: input.redirectUri,
      mode: input.mode,
      initiatingUserId: input.initiatingUserId?.value,
      expiresAt: input.expiresAt,
    });
  }

  async findByState(state: string, now: Temporal.Instant): Promise<OAuthState | null> {
    const row = await this.#db.query.oAuthState.findFirst({
      where: { state, expiresAt: { gt: now } },
    });
    return row == null ? null : this.#toOAuthState(row);
  }

  async findByExchangeCode(
    exchangeCode: string,
    now: Temporal.Instant,
  ): Promise<OAuthState | null> {
    const row = await this.#db.query.oAuthState.findFirst({
      where: { exchangeCode, exchangedAt: { isNull: true }, expiresAt: { gt: now } },
    });
    return row == null ? null : this.#toOAuthState(row);
  }

  async saveExchangeData(oauthStateId: OAuthStateId, data: OAuthLoginExchangeData): Promise<void> {
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

  async saveLinkingData(oauthStateId: OAuthStateId, data: OAuthLinkingData): Promise<void> {
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

  // 교환 시각·코드·만료를 조건에 두어 같은 코드의 동시 교환 중 하나만 성공한다
  async save(state: OAuthState): Promise<boolean> {
    const { exchangedAt, exchangeCode } = state.toPrimitives();
    if (exchangedAt == null || exchangeCode == null) {
      return false;
    }
    const saved = await this.#db
      .update(oAuthState)
      .set({ exchangedAt, accessToken: null, refreshToken: null })
      .where(
        and(
          eq(oAuthState.id, state.id.value),
          eq(oAuthState.exchangeCode, exchangeCode),
          isNull(oAuthState.exchangedAt),
          gt(oAuthState.expiresAt, exchangedAt),
        ),
      )
      .returning({ id: oAuthState.id });
    return saved.length === 1;
  }

  generateExchangeCode(): string {
    return randomBytes(32).toString("base64url");
  }

  async deleteExpiredBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const expiredStates = this.#db
      .select({ id: oAuthState.id })
      .from(oAuthState)
      .where(lt(oAuthState.expiresAt, cutoff))
      .limit(limit);
    const deleted = await this.#db
      .delete(oAuthState)
      .where(inArray(oAuthState.id, expiredStates))
      .returning({ id: oAuthState.id });
    return deleted.length;
  }

  get #db() {
    return this.#transactionHost.tx;
  }

  // 저장한 토큰은 암호문이라 복원 전에 푼다
  #toOAuthState(row: OAuthStateRow): OAuthState {
    return toOAuthState({
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
