import type { MeteredFeatureKey } from "@aido/api/vocabulary";

import type { QuotaRefundReason } from "../../domain/quotas.constants.js";
import type { MeteredFeatureQuota } from "../read-models/metered-feature-quota.read-model.js";
import type { QuotaReservation } from "../read-models/quota-reservation.read-model.js";

export interface QuotaReserveInput {
  readonly userId: string;
  readonly feature: MeteredFeatureKey;
  /** 사용자 행동 한 번을 가리키는 키(Idempotency-Key). 키가 없는 출시 앱 요청도 원장에 한 줄을 남긴다. */
  readonly idempotencyKey: string | null;
  /** 같은 키가 같은 요청인지 가리는 요청 내용의 해시. 사용자 글자를 넘기지 않는다. */
  readonly requestHash?: string;
  /** 차감한 작업 id (예: parse-todo). 고객 문의 때 원장에서 읽는다. */
  readonly reason: string;
}

/**
 * AI처럼 돈이 드는 기능의 사용 횟수 원장. AI 호출 전에 reserve로 원자적으로 차감하고, 결과를 주면 commit,
 * 실패·빈 결과면 refund(정확히 한 번)한다. 한도는 PLAN_CATALOG와 잠금 안의 최신 권한으로 정한다.
 */
export abstract class QuotaLedgerPort {
  /**
   * 한도를 넘으면 기능별 ErrorCode(AI_PARSE: AI_1303, VOICE_NOTE: AI_1313)를, 같은 키가 처리 중이면 AI_1314를
   * 던진다. 두 오류 모두 차감하지 않았고 details는 `{ charged: false, featureQuota }`다.
   * 같은 키로 작업이나 내용이 다른 요청이면 AI_1318(`{ charged: false }`)이다.
   */
  abstract reserve(input: QuotaReserveInput): Promise<QuotaReservation>;
  /**
   * isAlreadyCommitted인데 돌려줄 결과를 잃었을 때 같은 행을 다시 예약한다. 추가로 차감하지 않는다.
   * 이후는 평소처럼 commit·refund한다. 다른 재요청이 먼저 다시 열었으면 AI_1314다.
   */
  abstract reopen(reservation: QuotaReservation): Promise<QuotaReservation>;
  /** 바뀌었으면 true. 이미 확정·환불된 예약이나 이전 시도면 false다. 저장 오류는 기록하고 삼킨다. */
  abstract commit(reservation: QuotaReservation): Promise<boolean>;
  /**
   * 정확히 한 번만 돌려준다. 두 번째 호출·확정된 예약은 false다. 오류는 원래 요청 오류를 덮지 않도록 삼키고
   * false를 돌려주므로, false면 호출부는 응답에 charged:false를 주장하지 않는다.
   */
  abstract refund(reservation: QuotaReservation, reason: QuotaRefundReason): Promise<boolean>;
  abstract read(userId: string, feature: MeteredFeatureKey): Promise<MeteredFeatureQuota>;
}
