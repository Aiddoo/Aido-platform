import type { RewardAmount } from "@aido/api";

import type { InviteMilestoneView } from "../../../domain/policies/invites/invite-reward.policy.js";

/** 내 초대 화면에 필요한 코드·인원·보상 요약 */
export interface MyInviteView {
  readonly code: string;
  readonly waitingCount: number;
  readonly qualifiedCount: number;
  readonly premiumDaysInWindow: number;
  readonly totalPremiumDays: number;
  readonly nextMilestone: InviteMilestoneView | null;
  readonly rewardsEarned: readonly RewardAmount[];
  readonly createdAt: Date;
}
