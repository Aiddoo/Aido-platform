import type { AiUsageData } from "@aido/api";

export const AI_QUOTA = Symbol("AI_QUOTA");

export interface AiQuotaReservation {
  readonly userId: string;
  readonly periodId: string;
}

export interface AiQuotaPort {
  read(userId: string): Promise<AiUsageData>;
  reserve(userId: string): Promise<AiQuotaReservation>;
  /** 보상 실패를 격리하며 예약 당시 기간에만 사용량을 돌려준다. */
  release(reservation: AiQuotaReservation): Promise<void>;
}
