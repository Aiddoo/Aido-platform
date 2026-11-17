import type { RevokeReason } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull, ne } from "drizzle-orm";

import { SessionRepositoryPort } from "#api/modules/identity/sessions/application/ports/session.repository.port";
import { SessionId } from "#api/modules/identity/sessions/domain/session-id.vo";
import type { Session } from "#api/modules/identity/sessions/domain/session.aggregate";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { session } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";

import { toSession, toSessionRow } from "./session-row.mapper.js";

@Injectable()
export class DrizzleSessionRepository extends SessionRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  get #db() {
    return this.#transactionHost.tx;
  }

  async nextId(): Promise<SessionId> {
    return SessionId.reconstitute(createEntityId());
  }

  async findById(sessionId: SessionId): Promise<Session | null> {
    const row = await this.#db.query.session.findFirst({ where: { id: sessionId.value } });
    return row == null ? null : toSession(row);
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    const row = await this.#db.query.session.findFirst({ where: { refreshTokenHash } });
    return row == null ? null : toSession(row);
  }

  async listActiveByUserId(userId: UserId, now: Temporal.Instant): Promise<Session[]> {
    const rows = await this.#db.query.session.findMany({
      where: { userId: userId.value, revokedAt: { isNull: true }, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: "desc" },
    });
    return rows.map(toSession);
  }

  async save(entity: Session): Promise<boolean> {
    const row = toSessionRow(entity);
    const persistedTokenVersion = entity.persistedTokenVersion;
    const rotated = entity.hasRotatedSinceLoad();
    // 폐기만 했으면 폐기 칸만 쓴다. 그 사이 회전한 세션도 폐기하고, 처음 폐기 시각은 덮지 않는다
    const changes: Partial<typeof session.$inferInsert> = rotated
      ? {
          refreshTokenHash: row.refreshTokenHash,
          previousTokenHash: row.previousTokenHash,
          tokenVersion: row.tokenVersion,
          lastUsedAt: row.lastUsedAt,
          expiresAt: row.expiresAt,
          revokedAt: row.revokedAt,
          revokedReason: row.revokedReason,
          updatedAt: row.updatedAt,
        }
      : { revokedAt: row.revokedAt, revokedReason: row.revokedReason, updatedAt: row.updatedAt };
    const saved = await this.#db
      .insert(session)
      .values(row)
      .onConflictDoUpdate({
        target: session.id,
        set: changes,
        setWhere: and(
          isNull(session.revokedAt),
          rotated && persistedTokenVersion != null
            ? eq(session.tokenVersion, persistedTokenVersion)
            : undefined,
        ),
      })
      .returning({ id: session.id });
    return saved.length > 0;
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
