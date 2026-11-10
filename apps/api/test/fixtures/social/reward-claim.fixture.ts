import type { RewardClaimKind } from "#api/modules/social/invites/domain/invites.constants";
import { RewardClaim } from "#api/modules/social/invites/domain/reward-claim.vo";

/** 같은 글자 64개로 만든 해시. 글자가 다르면 다른 기기·신원이다. */
export function rewardClaimHashOf(character: string): string {
  return character.repeat(64);
}

export function createRewardClaimFixture(
  overrides: { readonly claimHash?: string; readonly claimKind?: RewardClaimKind } = {},
): RewardClaim {
  return RewardClaim.reconstitute({
    claimHash: overrides.claimHash ?? rewardClaimHashOf("a"),
    claimKind: overrides.claimKind ?? "INSTALLATION",
  });
}
