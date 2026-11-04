import type { EntitlementSnapshot, FeatureQuota } from "@aido/api";
import type { MeteredFeatureKey, PlanQuotaFeatureKey } from "@aido/api/vocabulary";

import type { QuotaUsageReading } from "../../../domain/policies/entitlement/entitlement.policy.js";

export const QUOTA_LEDGER = Symbol("QUOTA_LEDGER");

/** 환불 사유. FAILED는 AI 호출·검증 실패, NO_ACTION은 결과에 실행할 행동이 없던 요청이다. */
export const QUOTA_REFUND_REASONS = ["FAILED", "NO_ACTION"] as const;

export type QuotaRefundReason = (typeof QUOTA_REFUND_REASONS)[number];

/** 계량기 없이 소유 Context가 세는 일간 quota (CHEER·NUDGE) */
export type UnmeteredQuotaFeatureKey = Exclude<PlanQuotaFeatureKey, MeteredFeatureKey>;

export type { QuotaUsageReading };

/** 계량기 기능의 featureQuota. 사용량을 항상 세므로 used·resetsAt이 있다. */
export type MeteredFeatureQuota = FeatureQuota & {
  readonly used: number;
  readonly resetsAt: string;
};

export interface QuotaReserveInput {
  readonly userId: string;
  readonly feature: MeteredFeatureKey;
  /** 사용자 행동 한 번을 가리키는 키(Idempotency-Key). 키가 없는 출시 앱 요청도 원장에 한 줄을 남긴다. */
  readonly idempotencyKey: string | null;
  /** 차감한 작업 id (예: parse-todo). 고객 문의 때 원장에서 읽는다. */
  readonly reason: string;
}

export interface QuotaReservation {
  readonly chargeId: string;
  readonly userId: string;
  readonly feature: MeteredFeatureKey;
  readonly attempt: number;
  /**
   * 같은 키 요청이 이미 결과를 받아 확정된 차감이다. 이번 요청은 차감하지 않았으므로 AI를 다시 부르지 않고
   * 저장한 응답을 돌려준다. commit·refund는 아무것도 바꾸지 않는다.
   */
  readonly alreadyCommitted: boolean;
}

/**
 * AI처럼 돈이 드는 기능의 사용 횟수 원장. AI 호출 전에 reserve로 원자적으로 차감하고, 결과를 주면 commit,
 * 실패·빈 결과면 refund(정확히 한 번)한다. 한도는 PLAN_CATALOG와 잠금 안의 최신 권한으로 정한다.
 */
export interface QuotaLedgerPort {
  /**
   * 한도를 넘으면 기능별 ErrorCode(AI_PARSE: AI_1303, VOICE_NOTE: AI_1313)를, 같은 키가 처리 중이면 AI_1314를
   * 던진다. 두 오류 모두 차감하지 않았고 details는 `{ charged: false, featureQuota }`다.
   */
  reserve(input: QuotaReserveInput): Promise<QuotaReservation>;
  /** 바뀌었으면 true. 이미 확정·환불된 예약이나 이전 시도면 false다. 저장 오류는 기록하고 삼킨다. */
  commit(reservation: QuotaReservation): Promise<boolean>;
  /** 정확히 한 번만 돌려준다. 두 번째 호출·확정된 예약은 false다. 오류는 원래 요청 오류를 덮지 않도록 삼킨다. */
  refund(reservation: QuotaReservation, reason: QuotaRefundReason): Promise<boolean>;
  read(userId: string, feature: MeteredFeatureKey): Promise<MeteredFeatureQuota>;
  /** GET /v1/entitlements. 일간 quota(CHEER·NUDGE) 사용량은 소유 Context가 세어 넘긴다. */
  readSnapshot(
    userId: string,
    dailyUsage: Readonly<Record<UnmeteredQuotaFeatureKey, QuotaUsageReading>>,
  ): Promise<EntitlementSnapshot>;
}
