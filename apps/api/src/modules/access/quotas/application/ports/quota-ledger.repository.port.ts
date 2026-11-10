import type { QuotaChargeStatus, QuotaMeter } from "@aido/api/vocabulary";

import type { AccessState } from "../../../entitlements/domain/entitlement.domain-service.js";
import type { QuotaCharge, QuotaChargeDraft } from "../../domain/quota-charge.aggregate.js";
import type { QuotaWindow } from "../../domain/quota-window.vo.js";

export const QUOTA_LEDGER_REPOSITORY = Symbol("QUOTA_LEDGER_REPOSITORY");

export interface QuotaLedgerRepositoryPort {
  /** 계정 상태와 무관하게 사용자가 있으면 권한 판단 상태를 돌려준다. */
  findAccessState(userId: string): Promise<AccessState | null>;
  readUsed(userId: string, meter: QuotaMeter, window: QuotaWindow): Promise<number>;
  /** 한도 안이면 더하고 true. limit null은 무제한이다. */
  addUsage(
    userId: string,
    meter: QuotaMeter,
    input: {
      readonly window: QuotaWindow;
      readonly at: Date;
      readonly amount: number;
      readonly limit: number | null;
    },
  ): Promise<boolean>;
  /** 그 기간 카운터가 남아 있을 때만 빼고 true. 지난 기간의 사용량은 이미 0으로 보이므로 건드리지 않는다. */
  subtractUsage(
    userId: string,
    meter: QuotaMeter,
    input: { readonly periodKey: string; readonly amount: number },
  ): Promise<boolean>;
  findCharge(chargeId: string): Promise<QuotaCharge | null>;
  /** cutoff 이전에 마지막으로 바뀐 RESERVED 차감을 오래된 순서로 돌려준다. */
  findAbandonedReservations(cutoff: Date, limit: number): Promise<readonly QuotaCharge[]>;
  countReservationsBefore(cutoff: Date): Promise<number>;
  /** cutoff 이전에 만든 차감의 requestHash를 지운다. limit개씩만 지워 잠금을 짧게 둔다. */
  clearRequestHashesBefore(cutoff: Date, limit: number): Promise<number>;
  findChargeByKey(
    userId: string,
    meter: QuotaMeter,
    idempotencyKey: string,
  ): Promise<QuotaCharge | null>;
  insertCharge(draft: QuotaChargeDraft): Promise<QuotaCharge>;
  /** expected 상태·시도일 때만 저장하고 true. 동시에 다른 전이가 이겼으면 false다. */
  updateCharge(
    charge: QuotaCharge,
    expected: { readonly status: QuotaChargeStatus; readonly attempt: number },
  ): Promise<boolean>;
}
