import type { MeteredFeatureKey } from "@aido/api/vocabulary";

export interface QuotaReservation {
  readonly chargeId: string;
  readonly userId: string;
  readonly feature: MeteredFeatureKey;
  readonly attempt: number;
  /**
   * 같은 키 요청이 이미 결과를 받아 확정된 차감이다. 이번 요청은 차감하지 않았고 AI를 다시 부르지 않는다.
   * 원장은 결과를 저장하지 않으므로 돌려줄 결과는 호출 Context가 소유한다. commit·refund는 아무것도 바꾸지 않고,
   * 결과를 잃었으면 reopen으로 같은 행에서 다시 만든다.
   */
  readonly isAlreadyCommitted: boolean;
}
