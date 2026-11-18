import type { PremiumSource, SubscriptionPlanType } from "@aido/api/vocabulary";

/** 다른 Context에 여는 프리미엄 상태. 시각은 identity가 Temporal로 옮기기 전까지 Date로 건넨다. */
export interface PremiumAccessReadModel {
  readonly source: PremiumSource | null;
  readonly endsAt: Date | null;
  readonly periodEndsAt: Date | null;
  readonly willRenew: boolean;
  readonly isTrial: boolean;
  readonly planType: SubscriptionPlanType | null;
  readonly bankedDays: number;
  readonly recentGrantEndedAt: Date | null;
}
