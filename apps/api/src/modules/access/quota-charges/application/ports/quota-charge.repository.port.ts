import type { QuotaMeter } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { QuotaChargeId } from "../../domain/quota-charge-id.vo.js";
import type { QuotaCharge, QuotaChargeVersion } from "../../domain/quota-charge.aggregate.js";

export abstract class QuotaChargeRepositoryPort {
  abstract findById(chargeId: QuotaChargeId): Promise<QuotaCharge | null>;
  abstract findByIdempotencyKey(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly idempotencyKey: string;
  }): Promise<QuotaCharge | null>;
  /** cutoff 이전에 마지막으로 바뀐 RESERVED 차감을 오래된 순서로 limit개까지 돌려준다. */
  abstract listAbandonedReservations(params: {
    readonly cutoff: Temporal.Instant;
    readonly limit: number;
  }): Promise<QuotaCharge[]>;
  abstract countReservationsBefore(cutoff: Temporal.Instant): Promise<number>;
  /** cutoff 이전에 만든 차감의 requestHash를 지운다. limit개씩만 지워 잠금을 짧게 두고 지운 수를 돌려준다. */
  abstract clearRequestHashesBefore(params: {
    readonly cutoff: Temporal.Instant;
    readonly limit: number;
    readonly now: Temporal.Instant;
  }): Promise<number>;
  /** 새 차감을 저장한다. 같은 사용자·계량기·키가 이미 있으면 SYS_0004다. */
  abstract save(charge: QuotaCharge): Promise<void>;
  /** expected 상태·시도일 때만 저장하고 true. 동시에 다른 전이가 이겼으면 false다. */
  abstract saveIfUnchanged(charge: QuotaCharge, expected: QuotaChargeVersion): Promise<boolean>;
}
