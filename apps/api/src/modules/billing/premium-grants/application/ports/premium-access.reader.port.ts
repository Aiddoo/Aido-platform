import type { PremiumSource, SubscriptionPlanType } from "@aido/api/vocabulary";

// 옛 Symbol 토큰. identity가 클래스 토큰으로 옮길 때까지 같은 인스턴스를 가리키는 별칭으로 남긴다
export const PREMIUM_ACCESS_READER = Symbol("PREMIUM_ACCESS_READER");

/** 다른 Context에 여는 프리미엄 상태. 시각은 identity가 Temporal로 옮기기 전까지 Date로 건넨다. */
export interface PremiumAccess {
  readonly source: PremiumSource | null;
  readonly endsAt: Date | null;
  readonly periodEndsAt: Date | null;
  readonly willRenew: boolean;
  readonly isTrial: boolean;
  readonly planType: SubscriptionPlanType | null;
  readonly bankedDays: number;
  readonly recentGrantEndedAt: Date | null;
}

/** 스토어 구독과 보상 기간을 함께 본 현재 프리미엄 출처·종료 시각 */
export abstract class PremiumAccessReaderPort {
  abstract getPremiumAccess(userId: string): Promise<PremiumAccess>;
}
