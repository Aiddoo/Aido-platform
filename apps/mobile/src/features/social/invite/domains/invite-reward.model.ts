import { REWARD_TYPE, REWARD_TYPE_UNKNOWN } from '@aido/api/vocabulary';
import { sumBy } from 'es-toolkit';
import { z } from 'zod';

// 모르는 새 보상 종류는 응답을 읽을 때 UNKNOWN으로 바꿔 둔다
export const inviteRewardSchema = z.object({
  rewardType: z.union([z.enum(REWARD_TYPE), z.literal(REWARD_TYPE_UNKNOWN)]),
  quantity: z.int().nonnegative(),
});
export type InviteReward = z.infer<typeof inviteRewardSchema>;

export function isPremiumDaysReward(reward: InviteReward) {
  return reward.rewardType === REWARD_TYPE.PREMIUM_DAYS;
}

function isFriendSlotReward(reward: InviteReward) {
  return reward.rewardType === REWARD_TYPE.FRIEND_SLOT;
}

export function calculateRewardQuantity(
  rewards: readonly InviteReward[],
  isTarget: (reward: InviteReward) => boolean,
) {
  return sumBy(rewards.filter(isTarget), (reward) => reward.quantity);
}

export function getPremiumDays(rewards: readonly InviteReward[]) {
  return calculateRewardQuantity(rewards, isPremiumDaysReward);
}

export function getFriendSlots(rewards: readonly InviteReward[]) {
  return calculateRewardQuantity(rewards, isFriendSlotReward);
}

export const InviteRewardPolicy = {
  getPremiumDays,
  getFriendSlots,
  isPremiumDaysReward,
  calculateRewardQuantity,
} as const;
