import type { PremiumCapState } from "@aido/api/vocabulary";

import type { InviteMilestone, RewardAmount } from "../../domain/invite-reward.domain-service.js";

export interface InviterProgressReadModel {
  readonly waitingCount: number;
  readonly qualifiedCount: number;
  readonly premiumDaysInWindow: number;
  readonly totalPremiumDays: number;
  readonly premiumCapState: PremiumCapState;
  readonly nextMilestone: InviteMilestone | null;
  readonly rewardsEarned: readonly RewardAmount[];
}
