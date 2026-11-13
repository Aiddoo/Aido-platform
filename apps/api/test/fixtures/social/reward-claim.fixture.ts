import {
  RewardClaim,
  type RewardClaimPrimitives,
} from "#api/modules/social/invite-redemptions/domain/reward-claim.entity";

import { INVITE_FIXTURE_NOW } from "./invite.fixture.js";

// 같은 글자 64개로 만든 해시. 글자가 다르면 다른 기기·신원이다
export function rewardClaimHashOf(character: string): string {
  return character.repeat(64);
}

export function createRewardClaimFixture(
  overrides: Partial<RewardClaimPrimitives> = {},
): RewardClaim {
  return RewardClaim.reconstitute({
    claimHash: rewardClaimHashOf("a"),
    claimKind: "INSTALLATION",
    firstClaimedAt: INVITE_FIXTURE_NOW,
    ...overrides,
  });
}
