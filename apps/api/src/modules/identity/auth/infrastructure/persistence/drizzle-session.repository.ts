import { randomUUID } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, isNotNull, isNull, lt, ne, or } from "drizzle-orm";

import {
  AuthSessionRepositoryPort,
  type NewAuthSession,
} from "#api/modules/identity/auth/application/ports/auth-session.repository.port";
import type {
  AuthSession,
  AuthSessionRotation,
} from "#api/modules/identity/auth/domain/auth-session.aggregate";
import { AUTH_DEFAULTS } from "#api/modules/identity/auth/domain/auth.constants";
import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { session } from "#api/platform/database/schema/index";
import { now } from "#api/shared/domain/date/utils/core";
import { instantToDate } from "#api/shared/domain/time/instant";

import { toAuthSession } from "./auth-row.mapper.js";

type SessionRow = typeof session.$inferSelect;

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

  async create(data: NewAuthSession): Promise<SessionRow> {
    // refreshTokenHash가 없으면 임시 placeholder 생성 (unique 제약 조건 충족)
    const refreshTokenHash = `pending_${randomUUID().replace(/-/g, "")}`;

    const [row] = await this.#db
      .insert(session)
      .values({
        userId: data.userId,
        refreshTokenHash,
        tokenFamily: data.tokenFamily,
        tokenVersion: data.tokenVersion,
        deviceFingerprint: data.deviceFingerprint.substring(
          0,
          AUTH_DEFAULTS.MAX_DEVICE_FINGERPRINT_LENGTH,
        ),
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        expiresAt: instantToDate(data.expiresAt),
      })
      .returning();
    return requireRecord(row);
  }

  async updateRefreshTokenHash(id: string, refreshTokenHash: string): Promise<SessionRow> {
    const [row] = await this.#db
      .update(session)
      .set({ refreshTokenHash })
      .where(eq(session.id, id))
      .returning();
    return requireRecord(row);
  }

  async findById(id: string): Promise<AuthSession | null> {
    const row = await this.#db.query.session.findFirst({ where: { id } });
    return row == null ? null : toAuthSession(row);
  }

  async findByRefreshTokenHash(hash: string): Promise<AuthSession | null> {
    const row = await this.#db.query.session.findFirst({ where: { refreshTokenHash: hash } });
    return row == null ? null : toAuthSession(row);
  }

  async findActiveByUserId(userId: string): Promise<SessionRow[]> {
    return this.#db.query.session.findMany({
      where: { userId, revokedAt: { isNull: true }, expiresAt: { gt: now() } },
      orderBy: { lastUsedAt: "desc" },
    });
  }

  // 단건 update의 PK 선조회 대신 version·revoked 조건을 실제 UPDATE에 유지한다.
  async rotateToken(
    id: string,
    data: AuthSessionRotation,
    now: Temporal.Instant,
  ): Promise<boolean> {
    const rotated = await this.#db
      .update(session)
      .set({
        refreshTokenHash: data.refreshTokenHash,
        tokenVersion: data.tokenVersion,
        previousTokenHash: data.previousTokenHash,
        expiresAt: instantToDate(data.expiresAt),
        lastUsedAt: instantToDate(now),
      })
      .where(
        and(
          eq(session.id, id),
          eq(session.tokenVersion, data.expectedTokenVersion),
          isNull(session.revokedAt),
        ),
      )
      .returning({ id: session.id });
    return rotated.length > 0;
  }

  async revoke(id: string, reason: string): Promise<SessionRow> {
    const [row] = await this.#db
      .update(session)
      .set({ revokedAt: now(), revokedReason: reason })
      .where(eq(session.id, id))
      .returning();
    return requireRecord(row);
  }

  // 토큰 재사용 감지 시 전체 폐기
  async revokeByTokenFamily(tokenFamily: string, reason: string): Promise<readonly string[]> {
    const revoked = await this.#db
      .update(session)
      .set({ revokedAt: now(), revokedReason: reason })
      .where(and(eq(session.tokenFamily, tokenFamily), isNull(session.revokedAt)))
      .returning({ id: session.id });
    return revoked.map((row) => row.id);
  }

  async revokeAllByUserId(
    userId: string,
    reason: string,
    excludeSessionId?: string,
  ): Promise<readonly string[]> {
    const revoked = await this.#db
      .update(session)
      .set({ revokedAt: now(), revokedReason: reason })
      .where(
        and(
          eq(session.userId, userId),
          isNull(session.revokedAt),
          excludeSessionId != null && excludeSessionId.length > 0
            ? ne(session.id, excludeSessionId)
            : undefined,
        ),
      )
      .returning({ id: session.id });
    return revoked.map((row) => row.id);
  }

  async deleteExpired(): Promise<number> {
    const deleted = await this.#db
      .delete(session)
      .where(or(lt(session.expiresAt, now()), isNotNull(session.revokedAt)))
      .returning({ id: session.id });
    return deleted.length;
  }
}
