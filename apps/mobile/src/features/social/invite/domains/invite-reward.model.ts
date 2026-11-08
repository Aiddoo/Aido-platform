import { REWARD_TYPE } from '@aido/api/vocabulary';
import { sumBy } from 'es-toolkit';

import type { InviteReward } from '../schemas/invite-reward.schema';

function isPremiumDaysReward(reward: InviteReward) {
  return reward.rewardType === REWARD_TYPE.PREMIUM_DAYS;
}

function isFriendSlotReward(reward: InviteReward) {
  return reward.rewardType === REWARD_TYPE.FRIEND_SLOT;
}

function calculateRewardQuantity(
  rewards: readonly InviteReward[],
  isTarget: (reward: InviteReward) => boolean,
) {
  return sumBy(rewards.filter(isTarget), (reward) => reward.quantity);
}

function getPremiumDays(rewards: readonly InviteReward[]) {
  return calculateRewardQuantity(rewards, isPremiumDaysReward);
}

function getFriendSlots(rewards: readonly InviteReward[]) {
  return calculateRewardQuantity(rewards, isFriendSlotReward);
}

export const InviteRewardPolicy = {
  getPremiumDays,
  getFriendSlots,
  isPremiumDaysReward,
  calculateRewardQuantity,
} as const;
