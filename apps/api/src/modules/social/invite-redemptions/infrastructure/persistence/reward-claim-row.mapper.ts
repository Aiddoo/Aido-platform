import type { rewardClaim } from "#api/platform/database/schema/index";

import type { RewardClaim } from "../../domain/reward-claim.entity.js";

type RewardClaimRow = typeof rewardClaim.$inferInsert;

export function toRewardClaimRow(claim: RewardClaim): RewardClaimRow {
  return claim.toPrimitives();
}
