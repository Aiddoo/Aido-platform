import type { RevokeReason } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull, ne } from "drizzle-orm";

import { AuthSessionRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-session.repository.port";
import type {
  AuthSession,
  AuthSessionRotation,
} from "#api/modules/identity/auth/domain/auth-session.aggregate";
import { SessionId } from "#api/modules/identity/auth/domain/session-id.vo";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { session } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";

import { toAuthSession, toAuthSessionRow } from "./auth-row.mapper.js";

@Injectable()
export class DrizzleSessionRepository extends AuthSessionRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<SessionId> {
    return SessionId.reconstitute(createEntityId());
  }

  async findById(sessionId: SessionId): Promise<AuthSession | null> {
    const row = await this.#db.query.session.findFirst({ where: { id: sessionId.value } });
    return row == null ? null : toAuthSession(row);
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<AuthSession | null> {
    const row = await this.#db.query.session.findFirst({ where: { refreshTokenHash } });
    return row == null ? null : toAuthSession(row);
  }

  async listActiveByUserId(userId: UserId, now: Temporal.Instant): Promise<AuthSession[]> {
    const rows = await this.#db.query.session.findMany({
      where: { userId: userId.value, revokedAt: { isNull: true }, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: "desc" },
    });
    return rows.map(toAuthSession);
  }

  async save(authSession: AuthSession): Promise<void> {
    const row = toAuthSessionRow(authSession);
    await this.#db
      .insert(session)
      .values(row)
      .onConflictDoUpdate({
        target: session.id,
        set: {
          refreshTokenHash: row.refreshTokenHash,
          previousTokenHash: row.previousTokenHash,
          tokenVersion: row.tokenVersion,
          lastUsedAt: row.lastUsedAt,
          expiresAt: row.expiresAt,
          revokedAt: row.revokedAt,
          updatedAt: row.updatedAt,
        },
      });
  }

  // 단건 update의 PK 선조회 대신 version·revoked 조건을 실제 UPDATE에 유지한다.
  async rotateToken(
    sessionId: SessionId,
    rotation: AuthSessionRotation,
    now: Temporal.Instant,
  ): Promise<boolean> {
    const rotated = await this.#db
      .update(session)
      .set({
        refreshTokenHash: rotation.refreshTokenHash,
        tokenVersion: rotation.tokenVersion,
        previousTokenHash: rotation.previousTokenHash,
        expiresAt: rotation.expiresAt,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(session.id, sessionId.value),
          eq(session.tokenVersion, rotation.expectedTokenVersion),
          isNull(session.revokedAt),
        ),
      )
      .returning({ id: session.id });
    return rotated.length > 0;
  }

  // revokedReason은 읽는 곳이 없지만 폐기 사유 감사용으로 남긴다
  async revoke(sessionId: SessionId, reason: RevokeReason, now: Temporal.Instant): Promise<void> {
    await this.#db
      .update(session)
      .set({ revokedAt: now, revokedReason: reason, updatedAt: now })
      .where(eq(session.id, sessionId.value));
  }

  async revokeByTokenFamily(
    tokenFamily: string,
    reason: RevokeReason,
    now: Temporal.Instant,
  ): Promise<readonly SessionId[]> {
    const revoked = await this.#db
      .update(session)
      .set({ revokedAt: now, revokedReason: reason, updatedAt: now })
      .where(and(eq(session.tokenFamily, tokenFamily), isNull(session.revokedAt)))
      .returning({ id: session.id });
    return revoked.map((row) => SessionId.reconstitute(row.id));
  }

  async revokeAllByUserId(params: {
    readonly userId: UserId;
    readonly reason: RevokeReason;
    readonly now: Temporal.Instant;
    readonly exceptSessionId?: SessionId;
  }): Promise<readonly SessionId[]> {
    const { userId, reason, now, exceptSessionId } = params;
    const revoked = await this.#db
      .update(session)
      .set({ revokedAt: now, revokedReason: reason, updatedAt: now })
      .where(
        and(
          eq(session.userId, userId.value),
          isNull(session.revokedAt),
          exceptSessionId != null && exceptSessionId.value.length > 0
            ? ne(session.id, exceptSessionId.value)
            : undefined,
        ),
      )
      .returning({ id: session.id });
    return revoked.map((row) => SessionId.reconstitute(row.id));
  }
}
