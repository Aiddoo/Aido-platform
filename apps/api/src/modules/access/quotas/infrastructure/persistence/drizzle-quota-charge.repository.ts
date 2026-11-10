import type { QuotaMeter } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm";

import {
  databaseConstraint,
  isUniqueConstraintViolation,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import { quotaCharge } from "#api/platform/database/schema/access.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { QuotaChargeRepositoryPort } from "../../application/ports/quota-charge.repository.port.js";
import { quotaChargeConflict } from "../../application/quotas.errors.js";
import { QuotaChargeId } from "../../domain/quota-charge-id.vo.js";
import type { QuotaCharge, QuotaChargeVersion } from "../../domain/quota-charge.aggregate.js";
import { toQuotaCharge, toQuotaChargeRow } from "./quota-charge-row.mapper.js";

const IDEMPOTENCY_KEY_CONSTRAINT = "QuotaCharge_userId_meter_idempotencyKey_key";

/** 예약·환불은 Application이 잡은 사용자 행 잠금 안에서 실행된다. */
@Injectable()
export class DrizzleQuotaChargeRepository extends QuotaChargeRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<QuotaChargeId> {
    return QuotaChargeId.reconstitute(createEntityId());
  }

  async findById(chargeId: QuotaChargeId): Promise<QuotaCharge | null> {
    const [row] = await this.#db
      .select()
      .from(quotaCharge)
      .where(eq(quotaCharge.id, chargeId.value));
    return row == null ? null : toQuotaCharge(row);
  }

  async findByIdempotencyKey(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly idempotencyKey: string;
  }): Promise<QuotaCharge | null> {
    const [row] = await this.#db
      .select()
      .from(quotaCharge)
      .where(
        and(
          eq(quotaCharge.userId, params.userId.value),
          eq(quotaCharge.meter, params.meter),
          eq(quotaCharge.idempotencyKey, params.idempotencyKey),
        ),
      );
    return row == null ? null : toQuotaCharge(row);
  }

  async listAbandonedReservations(params: {
    readonly cutoff: Temporal.Instant;
    readonly limit: number;
  }): Promise<QuotaCharge[]> {
    const rows = await this.#db
      .select()
      .from(quotaCharge)
      .where(and(eq(quotaCharge.status, "RESERVED"), lte(quotaCharge.updatedAt, params.cutoff)))
      .orderBy(asc(quotaCharge.updatedAt))
      .limit(params.limit);
    return rows.map(toQuotaCharge);
  }

  countReservationsBefore(cutoff: Temporal.Instant): Promise<number> {
    return this.#db.$count(
      quotaCharge,
      and(eq(quotaCharge.status, "RESERVED"), lte(quotaCharge.updatedAt, cutoff)),
    );
  }

  async clearRequestHashesBefore(params: {
    readonly cutoff: Temporal.Instant;
    readonly limit: number;
    readonly now: Temporal.Instant;
  }): Promise<number> {
    const candidates = this.#db
      .select({ id: quotaCharge.id })
      .from(quotaCharge)
      .where(and(isNotNull(quotaCharge.requestHash), lte(quotaCharge.createdAt, params.cutoff)))
      .limit(params.limit);
    const cleared = await this.#db
      .update(quotaCharge)
      // 옮기기 전 $onUpdate처럼 지운 행의 수정 시각도 바꾼다
      .set({ requestHash: null, updatedAt: params.now })
      .where(inArray(quotaCharge.id, candidates))
      .returning({ id: quotaCharge.id });
    return cleared.length;
  }

  async save(charge: QuotaCharge): Promise<void> {
    const row = toQuotaChargeRow(charge);
    try {
      await this.#db
        .insert(quotaCharge)
        .values(row)
        .onConflictDoUpdate({
          target: quotaCharge.id,
          set: {
            status: row.status,
            attempt: row.attempt,
            reason: row.reason,
            refundReason: row.refundReason,
            periodKey: row.periodKey,
            updatedAt: row.updatedAt,
          },
        });
    } catch (error) {
      if (
        isUniqueConstraintViolation(error) &&
        databaseConstraint(error) === IDEMPOTENCY_KEY_CONSTRAINT
      ) {
        throw quotaChargeConflict();
      }
      throw error;
    }
  }

  async saveIfUnchanged(charge: QuotaCharge, expected: QuotaChargeVersion): Promise<boolean> {
    const row = toQuotaChargeRow(charge);
    const updated = await this.#db
      .update(quotaCharge)
      .set({
        status: row.status,
        attempt: row.attempt,
        reason: row.reason,
        refundReason: row.refundReason,
        periodKey: row.periodKey,
        updatedAt: row.updatedAt,
      })
      .where(
        and(
          eq(quotaCharge.id, charge.id.value),
          eq(quotaCharge.status, expected.status),
          eq(quotaCharge.attempt, expected.attempt),
        ),
      )
      .returning({ id: quotaCharge.id });
    return updated.length === 1;
  }
}
