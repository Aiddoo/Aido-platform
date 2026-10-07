import { randomUUID } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and, or } from "@prisma/orm-postgres/orm-client";

import type {
  AuthSessionRepositoryPort,
  RotateAuthSessionInput,
} from "#api/modules/identity/application/ports/auth/auth-persistence.port";
import type { CreateSessionData } from "#api/modules/identity/application/types/auth/index";
import { AUTH_DEFAULTS } from "#api/modules/identity/domain/constants/auth/auth.constants";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import type { Session } from "#api/platform/database/database.types";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { now } from "#api/shared/domain/date/utils/core";

@Injectable()
export class SessionRepository implements AuthSessionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async create(data: CreateSessionData): Promise<Session> {
    // refreshTokenHash가 없으면 임시 placeholder 생성 (unique 제약 조건 충족)
    const refreshTokenHash = data.refreshTokenHash ?? `pending_${randomUUID().replace(/-/g, "")}`;

    return this.client.orm.public.Session.create(
      encodeCreate("Session", {
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
        expiresAt: data.expiresAt,
      }),
    ).then((row) => decodeRecord("Session", row));
  }

  async updateRefreshTokenHash(id: string, refreshTokenHash: string): Promise<Session> {
    return this.client.orm.public.Session.where((row) => row.id.eq(id))
      .update(encodePatch("Session", { refreshTokenHash }))
      .then((row) => decodeRecord("Session", requireRecord(row)));
  }

  async findById(id: string): Promise<Session | null> {
    return this.client.orm.public.Session.where((row) => row.id.eq(id))
      .first()
      .then((row) => decodeRecord("Session", row));
  }

  async findByRefreshTokenHash(hash: string): Promise<Session | null> {
    return this.client.orm.public.Session.where((row) => row.refreshTokenHash.eq(varchar(hash, 64)))
      .first()
      .then((row) => decodeRecord("Session", row));
  }

  async findActiveByUserId(userId: string): Promise<Session[]> {
    return this.client.orm.public.Session.where((row) =>
      and(
        row.userId.eq(userId),
        row.revokedAt.isNull(),
        row.expiresAt.gt(databaseTimestamp(now())),
      ),
    )
      .orderBy((row) => row.lastUsedAt.desc())
      .all()
      .then((row) => decodeRecord("Session", row));
  }

  // 단건 update의 PK 선조회 대신 version·revoked 조건을 실제 UPDATE에 유지한다.
  async rotateToken(id: string, data: RotateAuthSessionInput): Promise<Session | null> {
    const rows = await this.client.orm.public.Session.where((row) =>
      and(row.id.eq(id), row.tokenVersion.eq(data.expectedTokenVersion), row.revokedAt.isNull()),
    ).updateAll(
      encodePatch("Session", {
        refreshTokenHash: data.refreshTokenHash,
        tokenVersion: data.tokenVersion,
        previousTokenHash: data.previousTokenHash,
        expiresAt: data.expiresAt,
        lastUsedAt: now(),
      }),
    );
    return decodeRecord("Session", rows[0] ?? null);
  }

  async revoke(id: string, reason: string): Promise<Session> {
    return this.client.orm.public.Session.where((row) => row.id.eq(id))
      .update(
        encodePatch("Session", {
          revokedAt: now(),
          revokedReason: reason,
        }),
      )
      .then((row) => decodeRecord("Session", requireRecord(row)));
  }

  // 토큰 재사용 감지 시 전체 폐기
  async revokeByTokenFamily(tokenFamily: string, reason: string): Promise<readonly string[]> {
    const revokedSessions = await this.client.orm.public.Session.where((row) =>
      and(row.tokenFamily.eq(varchar(tokenFamily, 36)), row.revokedAt.isNull()),
    )
      .select("id")
      .updateAll(
        encodePatch("Session", {
          revokedAt: now(),
          revokedReason: reason,
        }),
      );
    return revokedSessions.map((session) => session.id);
  }

  async revokeAllByUserId(
    userId: string,
    reason: string,
    excludeSessionId?: string,
  ): Promise<readonly string[]> {
    const sessions = await this.client.orm.public.Session.where((row) =>
      and(
        row.userId.eq(userId),
        row.revokedAt.isNull(),
        excludeSessionId !== undefined && excludeSessionId.length > 0
          ? row.id.neq(excludeSessionId)
          : all(),
      ),
    )
      .select("id")
      .updateAll(
        encodePatch("Session", {
          revokedAt: now(),
          revokedReason: reason,
        }),
      );
    return sessions.map((session) => session.id);
  }

  async deleteExpired(): Promise<number> {
    return this.client.orm.public.Session.where((row) =>
      or(row.expiresAt.lt(databaseTimestamp(now())), row.revokedAt.isNotNull()),
    ).deleteAndCount();
  }
}
