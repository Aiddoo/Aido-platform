import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, or } from "@prisma/orm-postgres/orm-client";

import { now } from "#api/shared/domain/date/utils/core";
import {
  decodeRecord,
  encodeCreate,
  encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import { databaseTimestamp, varchar } from "#api/shared/infrastructure/database/database-values";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import type {
  Verification,
  VerificationType,
} from "#api/shared/infrastructure/database/database.types";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

@Injectable()
export class VerificationRepository {
  constructor(
    private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>,
    // incrementAttempts는 활성 트랜잭션을 우회해야 하므로 베이스 클라이언트를 별도 주입한다.
    private readonly database: DatabaseService,
  ) {}

  /** 활성 트랜잭션(없으면 베이스 클라이언트) */
  private get client() {
    return this.txHost.tx;
  }

  async create(data: {
    userId: string;
    type: VerificationType;
    token: string; // SHA-256 해시
    expiresAt: Date;
  }): Promise<Verification> {
    return this.client.orm.public.Verification.create(
      encodeCreate("Verification", {
        userId: data.userId,
        type: data.type,
        token: data.token,
        expiresAt: data.expiresAt,
      }),
    ).then((row) => decodeRecord("Verification", row));
  }

  async findByToken(tokenHash: string): Promise<Verification | null> {
    return this.client.orm.public.Verification.where((row) => row.token.eq(varchar(tokenHash, 64)))
      .first()
      .then((row) => decodeRecord("Verification", row));
  }

  async findLatestByUserIdAndType(
    userId: string,
    type: VerificationType,
  ): Promise<Verification | null> {
    return this.client.orm.public.Verification.where((row) =>
      and(
        row.userId.eq(userId),
        row._type.eq(type),
        row.usedAt.isNull(),
        row.expiresAt.gt(databaseTimestamp(now())),
      ),
    )
      .orderBy((row) => row.createdAt.desc())
      .first()
      .then((row) => decodeRecord("Verification", row));
  }

  // 시도 횟수 검증은 서비스 레이어에서 수행
  async findValidByUserIdAndType(
    userId: string,
    type: VerificationType,
  ): Promise<Verification | null> {
    return this.client.orm.public.Verification.where((row) =>
      and(
        row.userId.eq(userId),
        row._type.eq(type),
        row.usedAt.isNull(),
        row.expiresAt.gt(databaseTimestamp(now())),
      ),
    )
      .orderBy((row) => row.createdAt.desc())
      .first()
      .then((row) => decodeRecord("Verification", row));
  }

  async markAsUsed(id: number): Promise<Verification> {
    return this.client.orm.public.Verification.where((row) => row.id.eq(id))
      .update(encodePatch("Verification", { usedAt: now() }))
      .then((row) => decodeRecord("Verification", requireRecord(row)));
  }

  /**
   * 인증 시도 횟수 증가.
   *
   * 브루트포스 보호를 위해 실패 횟수는 항상 영구 저장되어야 하므로, 호출측이 연
   * 트랜잭션(CLS)에 참여하지 않고 베이스 클라이언트로 독립 커밋한다(롤백 시에도 유지).
   */
  async incrementAttempts(id: number): Promise<Verification> {
    const db = this.database.db;
    const plan = db.sql.public.Verification.update((fields) => ({
      attempts: db.raw.sql`${fields.attempts} + ${1}`.returns("pg/int4@1"),
    }))
      .where((fields, functions) => functions.eq(fields.id, id))
      .returning("id", "userId", "type", "token", "expiresAt", "usedAt", "attempts", "createdAt")
      .build();
    const [row] = await db.runtime().query(plan);
    return decodeRecord("Verification", requireRecord(row));
  }

  /**
   * 원자적 인증 사용 처리 (조건부 업데이트)
   *
   * 조건:
   * - 토큰 해시 일치
   * - 사용자 ID 일치
   * - 타입 일치
   * - 미사용 (usedAt === null)
   * - 만료되지 않음 (expiresAt > now)
   * - 최대 시도 횟수 미초과
   *
   * @returns 조건 충족 시 업데이트된 Verification, 불충족 시 null
   */
  async markAsUsedAtomic(
    tokenHash: string,
    userId: string,
    type: VerificationType,
    maxAttempts: number,
  ): Promise<Verification | null> {
    const row = await this.client.orm.public.Verification.where((row) =>
      and(
        row.token.eq(varchar(tokenHash, 64)),
        row.userId.eq(userId),
        row._type.eq(type),
        row.usedAt.isNull(),
        row.expiresAt.gt(databaseTimestamp(now())),
        row.attempts.lt(maxAttempts),
      ),
    ).update(encodePatch("Verification", { usedAt: now() }));
    return decodeRecord("Verification", row);
  }

  async invalidateAllByUserIdAndType(userId: string, type: VerificationType): Promise<number> {
    // 만료 시간을 현재 시간으로 설정하여 무효화
    const result = {
      count: await this.client.orm.public.Verification.where((row) =>
        and(
          row.userId.eq(userId),
          row._type.eq(type),
          row.usedAt.isNull(),
          row.expiresAt.gt(databaseTimestamp(now())),
        ),
      ).updateAndCount(encodePatch("Verification", { expiresAt: now() })),
    };
    return result.count;
  }

  async countRecentByUserIdAndType(
    userId: string,
    type: VerificationType,
    since: Date,
  ): Promise<number> {
    return this.client.orm.public.Verification.where((row) =>
      and(row.userId.eq(userId), row._type.eq(type), row.createdAt.gte(databaseTimestamp(since))),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async deleteExpired(): Promise<number> {
    const result = {
      count: await this.database.db.orm.public.Verification.where((row) =>
        or(row.expiresAt.lt(databaseTimestamp(now())), row.usedAt.isNotNull()),
      ).deleteAndCount(),
    };
    return result.count;
  }
}
