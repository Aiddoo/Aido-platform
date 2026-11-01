import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";

import type {
  AuthVerificationRepositoryPort,
  ConsumeAuthVerificationInput,
} from "#api/modules/identity/application/ports/auth/auth-persistence.port";
import { requireRecord } from "#api/platform/database/database-error.util";
import {
  type Database,
  DRIZZLE,
  type DrizzleTransactionalAdapter,
} from "#api/platform/database/database.client";
import { verification } from "#api/platform/database/schema/index";
import { now } from "#api/shared/domain/date/utils/core";

type VerificationRow = typeof verification.$inferSelect;
type VerificationType = VerificationRow["type"];

@Injectable()
export class DrizzleVerificationRepository implements AuthVerificationRepositoryPort {
  constructor(
    private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>,
    // incrementAttempts는 활성 트랜잭션을 우회해야 하므로 베이스 클라이언트를 별도 주입한다.
    @Inject(DRIZZLE) private readonly baseDb: Database,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async create(data: {
    userId: string;
    type: VerificationType;
    token: string; // SHA-256 해시
    expiresAt: Date;
  }): Promise<VerificationRow> {
    const [row] = await this.db
      .insert(verification)
      .values({
        userId: data.userId,
        type: data.type,
        token: data.token,
        expiresAt: data.expiresAt,
      })
      .returning();
    return requireRecord(row);
  }

  async findValidByUserIdAndType(
    userId: string,
    type: VerificationType,
    at: Date = now(),
  ): Promise<VerificationRow | null> {
    const row = await this.db.query.verification.findFirst({
      where: { userId, type, usedAt: { isNull: true }, expiresAt: { gt: at } },
      orderBy: { createdAt: "desc" },
    });
    return row ?? null;
  }

  /**
   * 인증 시도 횟수 증가.
   *
   * 브루트포스 보호를 위해 실패 횟수는 항상 영구 저장되어야 하므로, 호출측이 연
   * 트랜잭션(CLS)에 참여하지 않고 베이스 클라이언트로 독립 커밋한다(롤백 시에도 유지).
   */
  async incrementAttempts(id: number): Promise<VerificationRow> {
    const [row] = await this.baseDb
      .update(verification)
      .set({ attempts: sql`${verification.attempts} + 1` })
      .where(eq(verification.id, id))
      .returning();
    return requireRecord(row);
  }

  async consume(input: ConsumeAuthVerificationInput): Promise<boolean> {
    const consumed = await this.db
      .update(verification)
      .set({ usedAt: input.at })
      .where(
        and(
          eq(verification.id, input.id),
          eq(verification.token, input.tokenHash),
          eq(verification.userId, input.userId),
          eq(verification.type, input.type),
          isNull(verification.usedAt),
          gt(verification.expiresAt, input.at),
          lt(verification.attempts, input.maxAttempts),
        ),
      )
      .returning({ id: verification.id });
    return consumed.length === 1;
  }

  async invalidateAllByUserIdAndType(userId: string, type: VerificationType): Promise<number> {
    // 만료 시간을 현재 시간으로 설정하여 무효화
    const invalidated = await this.db
      .update(verification)
      .set({ expiresAt: now() })
      .where(
        and(
          eq(verification.userId, userId),
          eq(verification.type, type),
          isNull(verification.usedAt),
          gt(verification.expiresAt, now()),
        ),
      )
      .returning({ id: verification.id });
    return invalidated.length;
  }

  async countRecentByUserIdAndType(
    userId: string,
    type: VerificationType,
    since: Date,
  ): Promise<number> {
    return this.db.$count(
      verification,
      and(
        eq(verification.userId, userId),
        eq(verification.type, type),
        gte(verification.createdAt, since),
      ),
    );
  }
}
