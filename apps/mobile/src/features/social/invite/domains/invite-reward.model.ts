import { REWARD_TYPE, REWARD_TYPE_UNKNOWN } from '@aido/api/vocabulary';
import { sumBy } from 'es-toolkit';
import { z } from 'zod';

// 모르는 새 보상 종류는 응답을 읽을 때 UNKNOWN으로 바꿔 둔다
export const inviteRewardSchema = z.object({
  rewardType: z.union([z.enum(REWARD_TYPE), z.literal(REWARD_TYPE_UNKNOWN)]),
  quantity: z.int().nonnegative(),
});
export type InviteReward = z.infer<typeof inviteRewardSchema>;

function isFriendSlotReward(reward: InviteReward) {
  return reward.rewardType === REWARD_TYPE.FRIEND_SLOT;
}

export const InviteRewardPolicy = {
  isPremiumDaysReward(reward: InviteReward): boolean {
    return reward.rewardType === REWARD_TYPE.PREMIUM_DAYS;
  },

  calculateRewardQuantity(
    rewards: readonly InviteReward[],
    isTarget: (reward: InviteReward) => boolean,
  ): number {
    return sumBy(rewards.filter(isTarget), (reward) => reward.quantity);
  },

  getPremiumDays(rewards: readonly InviteReward[]): number {
    return this.calculateRewardQuantity(rewards, (reward) => this.isPremiumDaysReward(reward));
  },

  getFriendSlots(rewards: readonly InviteReward[]): number {
    return this.calculateRewardQuantity(rewards, isFriendSlotReward);
  },
};
