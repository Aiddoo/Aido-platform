import { REWARD_TYPE } from "@aido/api/vocabulary";

import type { RewardApplier } from "../../../application/ports/invites/reward-applier.port.js";
import { createRewardApplierRegistry } from "./reward-appliers.registry.js";

describe("보상 Applier 레지스트리", () => {
  it("모든 RewardType에 서로 다른 Applier가 하나씩 있다", () => {
    // Given
    const premiumDays: RewardApplier = { apply: async () => {} };
    const friendSlot: RewardApplier = { apply: async () => {} };

    // When
    const registry = createRewardApplierRegistry({ premiumDays, friendSlot });

    // Then
    expect(Object.keys(registry).sort()).toEqual(Object.values(REWARD_TYPE).sort());
    expect(registry.PREMIUM_DAYS).toBe(premiumDays);
    expect(registry.FRIEND_SLOT).toBe(friendSlot);
  });
});
