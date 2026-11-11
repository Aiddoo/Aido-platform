import {
  RewardGrant,
  type RewardGrantPrimitives,
} from "#api/modules/social/invites/domain/reward-grant.entity";

import { INVITE_REDEMPTION_FIXTURE_ID } from "./invite-redemption.fixture.js";
import { INVITE_FIXTURE_INVITER_ID, INVITE_FIXTURE_NOW } from "./invite.fixture.js";

const REWARD_GRANT_FIXTURE_ID = "c0000000000000000000grt01";

export function createRewardGrantFixture(
  overrides: Partial<RewardGrantPrimitives> = {},
): RewardGrant {
  return RewardGrant.reconstitute({
    id: REWARD_GRANT_FIXTURE_ID,
    recipientId: INVITE_FIXTURE_INVITER_ID,
    sourceType: "INVITE_REDEMPTION",
    sourceId: INVITE_REDEMPTION_FIXTURE_ID,
    rewardType: "PREMIUM_DAYS",
    quantity: 7,
    status: "PENDING",
    attempts: 0,
    createdAt: INVITE_FIXTURE_NOW,
    ...overrides,
  });
}
