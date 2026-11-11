import type { PremiumCapState } from "@aido/api/vocabulary";

import type { InviteMilestone, RewardAmount } from "../../domain/invite-reward.domain-service.js";

/** 내 초대 화면에 필요한 코드·인원·보상 요약 */
export interface MyInvite {
  readonly code: string;
  readonly waitingCount: number;
  readonly qualifiedCount: number;
  readonly premiumDaysInWindow: number;
  readonly totalPremiumDays: number;
  readonly premiumCapState: PremiumCapState;
  readonly nextMilestone: InviteMilestone | null;
  readonly rewardsEarned: readonly RewardAmount[];
  readonly createdAt: Temporal.Instant;
}
