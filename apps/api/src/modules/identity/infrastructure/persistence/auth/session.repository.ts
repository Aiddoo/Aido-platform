import { randomUUID } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and, or } from "@prisma/orm-postgres/orm-client";

import type { CreateSessionData } from "#api/modules/identity/application/types/auth/index";
import { AUTH_DEFAULTS } from "#api/modules/identity/domain/constants/auth/auth.constants";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import type { Session } from "#api/platform/database/database.types";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { now } from "#api/shared/domain/date/utils/core";

@Injectable()
export class SessionRepository {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  /** 활성 트랜잭션(없으면 베이스 클라이언트) */
  private get client() {
    return this.txHost.tx;
  }

  // refreshTokenHash가 없는 경우 unique 제약 조건을 위해 임시 placeholder 해시 사용
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

  async findByTokenFamily(tokenFamily: string): Promise<Session | null> {
    return this.client.orm.public.Session.where((row) =>
      and(row.tokenFamily.eq(varchar(tokenFamily, 36)), row.revokedAt.isNull()),
    )
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

  /**
   * 세션 토큰 로테이션 업데이트 (낙관적 잠금)
   *
   * 레이스 컨디션 방지를 위해 expectedTokenVersion을 사용한 조건부 업데이트 수행.
   * 다른 요청이 먼저 로테이션한 경우 null 반환.
   *
   * @returns 성공 시 업데이트된 세션, 버전 불일치 또는 폐기된 세션인 경우 null
   */
  async rotateToken(
    id: string,
    data: {
      refreshTokenHash: string;
      tokenVersion: number;
      previousTokenHash: string;
      expectedTokenVersion: number; // 낙관적 잠금용
      expiresAt: Date;
    },
  ): Promise<Session | null> {
    const row = await this.client.orm.public.Session.where((row) =>
      and(row.id.eq(id), row.tokenVersion.eq(data.expectedTokenVersion), row.revokedAt.isNull()),
    ).update(
      encodePatch("Session", {
        refreshTokenHash: data.refreshTokenHash,
        tokenVersion: data.tokenVersion,
        previousTokenHash: data.previousTokenHash,
        expiresAt: data.expiresAt,
        lastUsedAt: now(),
      }),
    );
    return decodeRecord("Session", row);
  }

  async updateLastUsedAt(id: string): Promise<void> {
    decodeRecord(
      "Session",
      requireRecord(
        await this.client.orm.public.Session.where((row) => row.id.eq(id)).update(
          encodePatch("Session", { lastUsedAt: now() }),
        ),
      ),
    );
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
  async revokeByTokenFamily(tokenFamily: string, reason: string): Promise<number> {
    const result = {
      count: await this.client.orm.public.Session.where((row) =>
        and(row.tokenFamily.eq(varchar(tokenFamily, 36)), row.revokedAt.isNull()),
      ).updateAndCount(
        encodePatch("Session", {
          revokedAt: now(),
          revokedReason: reason,
        }),
      ),
    };
    return result.count;
  }

  async revokeAllByUserId(
    userId: string,
    reason: string,
    excludeSessionId?: string,
  ): Promise<number> {
    const result = {
      count: await this.client.orm.public.Session.where((row) =>
        and(
          row.userId.eq(userId),
          row.revokedAt.isNull(),
          excludeSessionId ? row.id.neq(excludeSessionId) : all(),
        ),
      ).updateAndCount(
        encodePatch("Session", {
          revokedAt: now(),
          revokedReason: reason,
        }),
      ),
    };
    return result.count;
  }

  async deleteExpired(): Promise<number> {
    const result = {
      count: await this.client.orm.public.Session.where((row) =>
        or(row.expiresAt.lt(databaseTimestamp(now())), row.revokedAt.isNotNull()),
      ).deleteAndCount(),
    };
    return result.count;
  }
}
