import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, lt, ne, not, or } from "drizzle-orm";

import { SessionRepositoryPort } from "#api/modules/identity/sessions/application/ports/session.repository.port";
import { SessionId } from "#api/modules/identity/sessions/domain/session-id.vo";
import type { Session } from "#api/modules/identity/sessions/domain/session.aggregate";
import type { RevokeReason } from "#api/modules/identity/sessions/domain/sessions.constants";
import { hasPushRegistrationForSessionCondition } from "#api/modules/notification/push-devices/notification-push-devices.public";
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
    if (persistedTokenVersion == null) {
      await this.#db.insert(session).values(row);
      return true;
    }
    const rotated = entity.hasRotatedSinceLoad();
    // 폐기만 했으면 폐기 칸만 쓴다. 그 사이 회전한 세션도 폐기하고, 처음 폐기 시각은 덮지 않는다.
    // 읽은 뒤 행이 사라졌으면(탈퇴 영구 삭제) 다시 넣지 않고 false다
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
      .update(session)
      .set(changes)
      .where(
        and(
          eq(session.id, entity.id.value),
          isNull(session.revokedAt),
          rotated ? eq(session.tokenVersion, persistedTokenVersion) : undefined,
        ),
      )
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

  async deleteEndedBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const endedSessions = this.#db
      .select({ id: session.id })
      .from(session)
      .where(
        or(
          lt(session.revokedAt, cutoff),
          and(
            lt(session.expiresAt, cutoff),
            // 앱을 열지 않고 알림만 받는 기기는 만료 세션에 묶여 있어 그 세션은 지우지 않는다
            not(hasPushRegistrationForSessionCondition(session.id)),
          ),
        ),
      )
      .limit(limit);
    const deleted = await this.#db
      .delete(session)
      .where(inArray(session.id, endedSessions))
      .returning({ id: session.id });
    return deleted.length;
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
