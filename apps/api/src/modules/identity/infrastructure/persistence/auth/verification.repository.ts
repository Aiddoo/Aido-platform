import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import type {
  AuthVerificationRepositoryPort,
  ConsumeAuthVerificationInput,
} from "#api/modules/identity/application/ports/auth/auth-persistence.port";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import { DatabaseService } from "#api/platform/database/database.service";
import type { Verification, VerificationType } from "#api/platform/database/database.types";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { now } from "#api/shared/domain/date/utils/core";

@Injectable()
export class VerificationRepository implements AuthVerificationRepositoryPort {
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

  async findValidByUserIdAndType(
    userId: string,
    type: VerificationType,
    at: Date = now(),
  ): Promise<Verification | null> {
    return this.client.orm.public.Verification.where((row) =>
      and(
        row.userId.eq(userId),
        row._type.eq(type),
        row.usedAt.isNull(),
        row.expiresAt.gt(databaseTimestamp(at)),
      ),
    )
      .orderBy((row) => row.createdAt.desc())
      .first()
      .then((row) => decodeRecord("Verification", row));
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

  async consume(input: ConsumeAuthVerificationInput): Promise<boolean> {
    const count = await this.client.orm.public.Verification.where((row) =>
      and(
        row.id.eq(input.id),
        row.token.eq(varchar(input.tokenHash, 64)),
        row.userId.eq(input.userId),
        row._type.eq(input.type),
        row.usedAt.isNull(),
        row.expiresAt.gt(databaseTimestamp(input.at)),
        row.attempts.lt(input.maxAttempts),
      ),
    ).updateAndCount(encodePatch("Verification", { usedAt: input.at }));
    return count === 1;
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
}
