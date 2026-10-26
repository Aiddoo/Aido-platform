import type { FactoryProvider } from "@nestjs/common";

import {
  REWARD_APPLIERS,
  type RewardApplier,
  type RewardApplierRegistry,
} from "../../../application/ports/invites/reward-applier.port.js";
import { FriendSlotRewardApplier } from "./friend-slot-reward.applier.js";
import { PremiumDaysRewardApplier } from "./premium-days-reward.applier.js";

/** RewardType마다 Applier가 하나씩 있어야 컴파일된다. */
export function createRewardApplierRegistry(appliers: {
  readonly premiumDays: RewardApplier;
  readonly friendSlot: RewardApplier;
}): RewardApplierRegistry {
  return {
    PREMIUM_DAYS: appliers.premiumDays,
    FRIEND_SLOT: appliers.friendSlot,
  } satisfies RewardApplierRegistry;
}

export const rewardAppliersProvider: FactoryProvider<RewardApplierRegistry> = {
  provide: REWARD_APPLIERS,
  inject: [PremiumDaysRewardApplier, FriendSlotRewardApplier],
  useFactory: (premiumDays: PremiumDaysRewardApplier, friendSlot: FriendSlotRewardApplier) =>
    createRewardApplierRegistry({ premiumDays, friendSlot }),
};
