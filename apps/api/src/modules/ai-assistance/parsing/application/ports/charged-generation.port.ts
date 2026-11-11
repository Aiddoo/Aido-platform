import type { MeteredFeatureKey } from "@aido/api/vocabulary";

import type {
  MeteredFeatureQuota,
  QuotaReservation,
} from "#api/modules/access/quotas/access-quotas.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AiTaskId } from "../../../generation/application/ports/ai-generator.port.js";

/** 결과를 준 뒤의 차감: 확정(CHARGE), 줄 결과는 있지만 환불(NO_ACTION), 줄 결과가 없어 AI_1302(EMPTY). */
const CHARGE_OUTCOMES = ["CHARGE", "NO_ACTION", "EMPTY"] as const;

export type ChargeOutcome = (typeof CHARGE_OUTCOMES)[number];

export interface ChargedGeneration<T> {
  readonly result: T;
  readonly outcome: ChargeOutcome;
}

export interface ChargedGenerationResult<T> {
  readonly result: T;
  /** 끝난 뒤에도 횟수가 차감된 상태인지. 환불·확정을 마치지 못했으면 실제 상태에 맞춰 답한다. */
  readonly charged: boolean;
  /** 결과를 준 뒤 한도를 읽지 못했으면 null이다. 차감한 결과를 잃지 않으려고 오류로 바꾸지 않는다. */
  readonly featureQuota: MeteredFeatureQuota | null;
}

export interface SettleChargedGenerationInput<T> {
  readonly reservation: QuotaReservation;
  readonly userId: UserId;
  readonly feature: MeteredFeatureKey;
  readonly task: AiTaskId;
  readonly generate: () => Promise<ChargedGeneration<T>>;
  /** 확정 직전에 부른다. 사이에 온 재요청은 처리 중(AI_1314)으로 답한다. */
  readonly beforeCommit?: (result: T) => Promise<void>;
}

/**
 * 돈이 드는 AI 작업의 예약 뒤 흐름(사용자 한도 정산): 생성 → 실패·빈 결과면 환불, 결과가 있으면 확정.
 * 환불을 마친 실패만 charged:false를 주장하고, 확정하지 못하면 charged:false로 답한다.
 */
export abstract class ChargedGenerationPort {
  abstract settle<T>(input: SettleChargedGenerationInput<T>): Promise<ChargedGenerationResult<T>>;
  /** 이미 있는 결과를 돌려주며 그 결과의 예약을 확정한다. 확정했으면 true */
  abstract commit(input: {
    readonly reservation: QuotaReservation;
    readonly task: AiTaskId;
  }): Promise<boolean>;
  /** 확정·환불 뒤의 한도 읽기. 실패해도 이미 만든 결과를 잃지 않게 null을 돌려준다(응답 칸은 optional이다). */
  abstract readFeatureQuota(input: {
    readonly userId: UserId;
    readonly feature: MeteredFeatureKey;
    readonly task: AiTaskId;
  }): Promise<MeteredFeatureQuota | null>;
}
