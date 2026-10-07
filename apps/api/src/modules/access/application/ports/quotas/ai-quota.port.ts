import type { AiUsageData } from "@aido/api";

export const AI_QUOTA = Symbol("AI_QUOTA");

export interface AiQuotaReservation {
  readonly userId: string;
  readonly periodId: string;
}

export interface AiQuotaPort {
  read(userId: string): Promise<AiUsageData>;
  reserve(userId: string): Promise<AiQuotaReservation>;
  /** 실패 보상은 같은 기간에만 적용하며, 보상 오류는 원래 요청 오류를 덮지 않는다. */
  release(reservation: AiQuotaReservation): Promise<void>;
}
