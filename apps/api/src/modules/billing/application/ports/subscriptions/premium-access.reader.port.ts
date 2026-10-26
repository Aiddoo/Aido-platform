import type { PremiumAccess } from "../../../domain/policies/subscriptions/premium-access.policy.js";

export type { PremiumAccess };

export const PREMIUM_ACCESS_READER = Symbol("PREMIUM_ACCESS_READER");

/** 스토어 구독과 보상 기간을 함께 본 현재 프리미엄 출처·종료 시각 */
export interface PremiumAccessReaderPort {
  getPremiumAccess(userId: string): Promise<PremiumAccess>;
}
