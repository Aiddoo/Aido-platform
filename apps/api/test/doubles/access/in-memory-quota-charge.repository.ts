import type { QuotaMeter } from "@aido/api/vocabulary";

import { QuotaChargeRepositoryPort } from "#api/modules/access/quotas/application/ports/quota-charge.repository.port";
import { quotaChargeConflict } from "#api/modules/access/quotas/application/quotas.errors";
import { QuotaChargeId } from "#api/modules/access/quotas/domain/quota-charge-id.vo";
import {
  QuotaCharge,
  type QuotaChargePrimitives,
  type QuotaChargeVersion,
} from "#api/modules/access/quotas/domain/quota-charge.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function isReservedBefore(charge: QuotaChargePrimitives, cutoff: Temporal.Instant): boolean {
  return charge.status === "RESERVED" && Temporal.Instant.compare(charge.updatedAt, cutoff) <= 0;
}

// 저장 사본만 두어 저장하지 않고 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
export class InMemoryQuotaChargeRepository extends QuotaChargeRepositoryPort {
  readonly #charges = new Map<string, QuotaChargePrimitives>();
  #sequence = 0;

  /** 저장 순서대로의 차감 행 */
  get all(): readonly QuotaChargePrimitives[] {
    return [...this.#charges.values()];
  }

  async nextId(): Promise<QuotaChargeId> {
    this.#sequence += 1;
    return QuotaChargeId.reconstitute(`charge-${this.#sequence}`);
  }

  async findById(chargeId: QuotaChargeId): Promise<QuotaCharge | null> {
    const stored = this.#charges.get(chargeId.value);
    return stored == null ? null : QuotaCharge.reconstitute(stored);
  }

  async findByIdempotencyKey(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly idempotencyKey: string;
  }): Promise<QuotaCharge | null> {
    const stored = this.all.find(
      (charge) =>
        charge.userId === params.userId.value &&
        charge.meter === params.meter &&
        charge.idempotencyKey === params.idempotencyKey,
    );
    return stored == null ? null : QuotaCharge.reconstitute(stored);
  }

  async listAbandonedReservations(params: {
    readonly cutoff: Temporal.Instant;
    readonly limit: number;
  }): Promise<QuotaCharge[]> {
    return this.all
      .filter((charge) => isReservedBefore(charge, params.cutoff))
      .toSorted((left, right) => Temporal.Instant.compare(left.updatedAt, right.updatedAt))
      .slice(0, params.limit)
      .map((charge) => QuotaCharge.reconstitute(charge));
  }

  async countReservationsBefore(cutoff: Temporal.Instant): Promise<number> {
    return this.all.filter((charge) => isReservedBefore(charge, cutoff)).length;
  }

  async clearRequestHashesBefore(params: {
    readonly cutoff: Temporal.Instant;
    readonly limit: number;
    readonly now: Temporal.Instant;
  }): Promise<number> {
    const stale = this.all
      .filter(
        (charge) =>
          charge.requestHash != null &&
          Temporal.Instant.compare(charge.createdAt, params.cutoff) <= 0,
      )
      .slice(0, params.limit);
    for (const charge of stale) {
      this.#charges.set(charge.id, { ...charge, requestHash: null, updatedAt: params.now });
    }
    return stale.length;
  }

  async save(charge: QuotaCharge): Promise<void> {
    const primitives = charge.toPrimitives();
    const duplicate = this.all.some(
      (stored) =>
        stored.id !== primitives.id &&
        primitives.idempotencyKey != null &&
        stored.userId === primitives.userId &&
        stored.meter === primitives.meter &&
        stored.idempotencyKey === primitives.idempotencyKey,
    );
    if (duplicate) {
      throw quotaChargeConflict();
    }
    const stored = this.#charges.get(primitives.id);
    this.#charges.set(primitives.id, {
      ...primitives,
      createdAt: stored?.createdAt ?? primitives.createdAt,
    });
  }

  async saveIfUnchanged(charge: QuotaCharge, expected: QuotaChargeVersion): Promise<boolean> {
    const primitives = charge.toPrimitives();
    const stored = this.#charges.get(primitives.id);
    if (
      stored == null ||
      stored.status !== expected.status ||
      stored.attempt !== expected.attempt
    ) {
      return false;
    }
    this.#charges.set(primitives.id, {
      ...stored,
      status: primitives.status,
      attempt: primitives.attempt,
      reason: primitives.reason,
      refundReason: primitives.refundReason,
      periodKey: primitives.periodKey,
      updatedAt: primitives.updatedAt,
    });
    return true;
  }
}
