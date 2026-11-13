import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";

import {
  AuthVerificationRepositoryPort,
  type ConsumeAuthVerificationInput,
} from "#api/modules/identity/auth/application/ports/auth-verification.repository.port";
import type { AuthVerification } from "#api/modules/identity/auth/domain/auth-verification.aggregate";
import type { VerificationType } from "#api/modules/identity/auth/domain/auth.constants";
import { VerificationId } from "#api/modules/identity/auth/domain/verification-id.vo";
import {
  type Database,
  DRIZZLE,
  type DrizzleTransactionalAdapter,
} from "#api/platform/database/database.client";
import { verification } from "#api/platform/database/schema/index";
import { nextSequenceValue } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { toAuthVerification, toVerificationRow } from "./auth-row.mapper.js";

@Injectable()
export class DrizzleVerificationRepository extends AuthVerificationRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  // incrementAttempts는 활성 트랜잭션을 우회해야 하므로 베이스 클라이언트를 별도 주입한다
  readonly #baseDb: Database;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    @Inject(DRIZZLE) baseDb: Database,
  ) {
    super();
    this.#txHost = txHost;
    this.#baseDb = baseDb;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<VerificationId> {
    return VerificationId.reconstitute(await nextSequenceValue(this.#db, verification.id));
  }

  async findValidByUserIdAndType(
    userId: UserId,
    type: VerificationType,
    now: Temporal.Instant,
  ): Promise<AuthVerification | null> {
    const row = await this.#db.query.verification.findFirst({
      where: { userId: userId.value, type, usedAt: { isNull: true }, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc", id: "desc" },
    });
    return row == null ? null : toAuthVerification(row);
  }

  async findLatestIssuedAtByUserIdAndType(
    userId: UserId,
    type: VerificationType,
    since: Temporal.Instant,
  ): Promise<Temporal.Instant | null> {
    const row = await this.#db.query.verification.findFirst({
      columns: { createdAt: true },
      where: { userId: userId.value, type, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });
    return row?.createdAt ?? null;
  }

  async save(authVerification: AuthVerification): Promise<void> {
    const row = toVerificationRow(authVerification);
    await this.#db
      .insert(verification)
      .values(row)
      .onConflictDoUpdate({
        target: verification.id,
        set: { expiresAt: row.expiresAt, attempts: row.attempts, usedAt: row.usedAt },
      });
  }

  async invalidateAllByUserIdAndType(
    userId: UserId,
    type: VerificationType,
    now: Temporal.Instant,
  ): Promise<number> {
    const invalidated = await this.#db
      .update(verification)
      .set({ expiresAt: now })
      .where(
        and(
          eq(verification.userId, userId.value),
          eq(verification.type, type),
          isNull(verification.usedAt),
          gt(verification.expiresAt, now),
        ),
      )
      .returning({ id: verification.id });
    return invalidated.length;
  }

  async consume(input: ConsumeAuthVerificationInput): Promise<boolean> {
    const consumed = await this.#db
      .update(verification)
      .set({ usedAt: input.at })
      .where(
        and(
          eq(verification.id, input.id.value),
          eq(verification.token, input.tokenHash),
          eq(verification.userId, input.userId.value),
          eq(verification.type, input.type),
          isNull(verification.usedAt),
          gt(verification.expiresAt, input.at),
          lt(verification.attempts, input.maxAttempts),
        ),
      )
      .returning({ id: verification.id });
    return consumed.length === 1;
  }

  // 브루트포스 보호를 위해 호출자 트랜잭션(CLS)에 참여하지 않고 베이스 클라이언트로 독립 커밋한다
  async incrementAttempts(verificationId: VerificationId): Promise<void> {
    await this.#baseDb
      .update(verification)
      .set({ attempts: sql`${verification.attempts} + 1` })
      .where(eq(verification.id, verificationId.value));
  }
}
